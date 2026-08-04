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
  retry_count: number;
  period_start: string | null;
  period_end: string | null;
  row_count: number | null;
  summary: UploadRow["summary"];
  expires_at: string;
  created_at: string;
  started_at: string;
  finished_at: string | null;
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
    retryCount: row.retry_count,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    rowCount: row.row_count,
    summary: row.summary,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function toUploadPatch(patch: Partial<UploadRow>): Record<string, unknown> {
  const columns: Array<[keyof UploadRow, string]> = [
    ["storagePath", "storage_path"],
    ["filename", "filename"],
    ["fileHash", "file_hash"],
    ["status", "status"],
    ["errorCode", "error_code"],
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
