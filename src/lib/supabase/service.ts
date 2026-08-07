import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClassifiedTxn, UploadRow } from "@/types";

const ORIGINALS_BUCKET = "csv-uploads";

type UploadDatabaseRow = {
  id: string;
  user_id: string;
  storage_path: string;
  filename: string | null;
  file_hash: string;
  status: UploadRow["status"];
  error_code: UploadRow["errorCode"];
  error_detail: UploadRow["errorDetail"];
  retry_count: number;
  period_start: string | null;
  period_end: string | null;
  row_count: number | null;
  summary: UploadRow["summary"];
  expires_at: string;
  created_at: string;
  started_at: string;
  finished_at: string | null;
  recompute_started_at: string | null;
  recomputed_at: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing env: ${name}`);
  }
  return value;
}

function assertUserStoragePath(userId: string, storagePath: string): void {
  if (!storagePath.startsWith(`${userId}/`)) {
    throw new Error("storage path is outside user scope");
  }
}

function toUploadRow(row: UploadDatabaseRow): UploadRow {
  return {
    id: row.id,
    userId: row.user_id,
    storagePath: row.storage_path,
    filename: row.filename,
    fileHash: row.file_hash,
    status: row.status,
    errorCode: row.error_code,
    errorDetail: row.error_detail ?? null,
    retryCount: row.retry_count,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    rowCount: row.row_count,
    summary: row.summary,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    recomputeStartedAt: row.recompute_started_at ?? null,
    recomputedAt: row.recomputed_at ?? null,
  };
}

function toUploadPatch(patch: Partial<UploadRow>): Record<string, unknown> {
  const columns: Array<[keyof UploadRow, string]> = [
    ["storagePath", "storage_path"],
    ["filename", "filename"],
    ["fileHash", "file_hash"],
    ["status", "status"],
    ["errorCode", "error_code"],
    ["errorDetail", "error_detail"],
    ["retryCount", "retry_count"],
    ["periodStart", "period_start"],
    ["periodEnd", "period_end"],
    ["rowCount", "row_count"],
    ["summary", "summary"],
    ["expiresAt", "expires_at"],
    ["startedAt", "started_at"],
    ["finishedAt", "finished_at"],
  ];

  return Object.fromEntries(
    columns.flatMap(([property, column]) =>
      property in patch ? [[column, patch[property]]] : [],
    ),
  );
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

export function storagePathFor(userId: string, uploadId: string): string {
  return `${userId}/${uploadId}.csv`;
}

export async function getProfilePlan(
  userId: string,
): Promise<"free" | "pro"> {
  const { data, error } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("user_id", userId)
    .single();

  if (error) {
    throw error;
  }
  return data.plan as "free" | "pro";
}

export async function getUploadForUser(
  userId: string,
  uploadId: string,
): Promise<UploadRow | null> {
  const { data, error } = await createServiceClient()
    .from("uploads")
    .select("*")
    .eq("user_id", userId)
    .eq("id", uploadId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data ? toUploadRow(data as UploadDatabaseRow) : null;
}

export async function updateUploadForUser(
  userId: string,
  uploadId: string,
  patch: Partial<UploadRow>,
): Promise<void> {
  const { error } = await createServiceClient()
    .from("uploads")
    .update(toUploadPatch(patch))
    .eq("user_id", userId)
    .eq("id", uploadId);

  if (error) {
    throw error;
  }
}

/**
 * 재시도 슬롯을 선점한다. 관측한 status·retry_count 를 UPDATE 의 WHERE 에 그대로 실어
 * 비교-교환으로 처리한다 — 읽고 나서 쓰면 동시 요청 둘이 같은 retry_count 를 읽고
 * 둘 다 분석을 띄워 한도가 뚫리고 LLM 비용이 두 번 나간다.
 * 갱신된 행이 없으면 다른 요청이 먼저 가져간 것이므로 false.
 */
export async function claimUploadRetry(
  userId: string,
  uploadId: string,
  expectedRetryCount: number,
): Promise<boolean> {
  const { data, error } = await createServiceClient()
    .from("uploads")
    .update({
      retry_count: expectedRetryCount + 1,
      status: "processing",
      error_code: null,
      finished_at: null,
    })
    .eq("user_id", userId)
    .eq("id", uploadId)
    .eq("status", "failed")
    .eq("retry_count", expectedRetryCount)
    .select("id");

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

/** 재계산 잠금의 유효 기간. 이보다 오래된 선점은 죽은 것으로 본다. */
export const RECOMPUTE_LOCK_MS = 15 * 60 * 1000;

/**
 * 15분 창 안의 선점만 '재계산 중'이다. 창을 두지 않으면 분석이 죽었을 때 잠금이
 * 영원히 남아, 화면은 돌아오지 않는 결과를 기다리고 버튼도 다시 나오지 않는다.
 */
export function isRecomputing(startedAt: string | null): boolean {
  return (
    startedAt !== null && Date.parse(startedAt) > Date.now() - RECOMPUTE_LOCK_MS
  );
}

/**
 * 재계산 슬롯을 선점한다. claimUploadRetry 와 같은 비교-교환이지만 status 는
 * completed 그대로 두고 retry_count 도 건드리지 않는다 — 재계산은 실패 복구가
 * 아니므로 실패 재시도 한도를 소모하면 안 된다.
 * 갱신된 행이 없으면 다른 재계산이 이미 돌고 있다는 뜻이므로 false.
 */
export async function claimUploadRecompute(
  userId: string,
  uploadId: string,
): Promise<boolean> {
  const startedAt = new Date();
  const staleBefore = new Date(startedAt.getTime() - RECOMPUTE_LOCK_MS);
  const { data, error } = await createServiceClient()
    .from("uploads")
    .update({ recompute_started_at: startedAt.toISOString() })
    .eq("user_id", userId)
    .eq("id", uploadId)
    .eq("status", "completed")
    .or(
      `recompute_started_at.is.null,recompute_started_at.lt.${staleBefore.toISOString()}`,
    )
    .select("id");

  if (error) {
    throw error;
  }
  return (data ?? []).length > 0;
}

/** 끝나지 못한 재계산의 잠금만 푼다. 저장된 결과는 그대로 둔다. */
export async function releaseUploadRecompute(
  userId: string,
  uploadId: string,
): Promise<void> {
  const { error } = await createServiceClient()
    .from("uploads")
    .update({ recompute_started_at: null })
    .eq("user_id", userId)
    .eq("id", uploadId);

  if (error) {
    throw error;
  }
}

type UploadResult = Pick<
  UploadRow,
  "summary" | "periodStart" | "periodEnd" | "rowCount"
>;

/**
 * 새 결과로 기존 결과를 통째로 갈아 끼운다. delete → insert → uploads update 를
 * 0007 의 plpgsql 함수가 한 트랜잭션으로 감싸므로, 중간에 실패해도 반쯤 갈아엎힌
 * 결과가 남지 않는다.
 */
export async function replaceUploadResultForUser(
  userId: string,
  uploadId: string,
  rows: ClassifiedTxn[],
  result: UploadResult,
): Promise<void> {
  const { error } = await createServiceClient().rpc("replace_upload_result", {
    p_user_id: userId,
    p_upload_id: uploadId,
    // 소유권은 인자에서만 온다. 행마다 user_id 를 실으면 남의 업로드에 거래를
    // 꽂을 수 있는 자리가 생긴다.
    p_transactions: rows.map((row) => ({
      row_index: row.rowIndex,
      txn_date: row.txnDate,
      merchant: row.merchant,
      amount: row.amount,
      account_code: row.accountCode,
      verdict: row.verdict,
    })),
    p_summary: result.summary,
    p_period_start: result.periodStart,
    p_period_end: result.periodEnd,
    p_row_count: result.rowCount,
  });

  if (error) {
    throw error;
  }
}

export async function insertTransactionsForUser(
  userId: string,
  uploadId: string,
  rows: ClassifiedTxn[],
): Promise<void> {
  const records = rows.map((row) => ({
    user_id: userId,
    upload_id: uploadId,
    row_index: row.rowIndex,
    txn_date: row.txnDate,
    merchant: row.merchant,
    amount: row.amount,
    account_code: row.accountCode,
    verdict: row.verdict,
  }));
  const { error } = await createServiceClient()
    .from("transactions")
    .insert(records);

  if (error) {
    throw error;
  }
}

export async function deleteTransactionsForUser(
  userId: string,
  uploadId: string,
): Promise<void> {
  const { error } = await createServiceClient()
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("upload_id", uploadId);

  if (error) {
    throw error;
  }
}

export async function downloadOriginalForUser(
  userId: string,
  storagePath: string,
): Promise<Uint8Array> {
  assertUserStoragePath(userId, storagePath);
  const { data, error } = await createServiceClient()
    .storage.from(ORIGINALS_BUCKET)
    .download(storagePath);

  if (error) {
    throw error;
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function deleteOriginalForUser(
  userId: string,
  storagePath: string,
): Promise<void> {
  assertUserStoragePath(userId, storagePath);
  const { error } = await createServiceClient()
    .storage.from(ORIGINALS_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw error;
  }
}
