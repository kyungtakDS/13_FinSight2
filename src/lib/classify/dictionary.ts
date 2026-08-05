import { createServiceClient } from "@/lib/supabase/service";
import { isAccountCode, type AccountCode } from "@/types/account-codes";

/**
 * PostgREST 는 .in() 필터를 URL 쿼리스트링에 싣는다. 한글 가맹점명은 퍼센트 인코딩
 * 시 문자당 9 바이트로 불어나, 개수로만 배치하면 게이트웨이의 URI 한도(보통 8KB)를
 * 넘겨 요청 자체가 거절된다. 실제로 고유 가맹점 131 개짜리 업로드에서 필터가
 * 8,880 바이트가 되어 분석이 죽었다. 그래서 개수가 아니라 인코딩 길이로 쪼갠다.
 */
export const LOOKUP_FILTER_BUDGET_BYTES = 2_000;

const MAX_REASON_LENGTH = 500;

/** 키 하나가 in() 필터에서 차지하는 길이 — 값 + 따옴표 두 개 + 구분자 하나. */
function keyCost(key: string): number {
  return encodeURIComponent(key).length + 3;
}

/** 키 묶음이 URL 에서 차지할 필터 길이. */
export function encodedFilterBytes(keys: string[]): number {
  return keys.reduce((total, key) => total + keyCost(key), 0);
}

function budgetedBatches(keys: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let size = 0;

  for (const key of keys) {
    const cost = keyCost(key);
    // 예산을 넘는 키 하나뿐이라면 그대로 보낸다 — 못 보내면 영원히 미분류로 남는다.
    if (current.length > 0 && size + cost > LOOKUP_FILTER_BUDGET_BYTES) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(key);
    size += cost;
  }

  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

type DictionaryVerdict = "expense" | "personal";

type DictionaryRow = {
  merchant_key: string;
  account_code: AccountCode;
  default_verdict: DictionaryVerdict;
  reason: string | null;
};

export interface DictEntry {
  merchantKey: string;
  accountCode: AccountCode;
  defaultVerdict: DictionaryVerdict;
  reason: string | null;
}

export function merchantKey(merchant: string): string {
  return merchant.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase();
}

export async function lookupMerchants(
  keys: string[],
): Promise<Map<string, DictEntry>> {
  const normalizedKeys = [
    ...new Set(keys.map((key) => merchantKey(key)).filter(Boolean)),
  ];
  const entries = new Map<string, DictEntry>();

  if (normalizedKeys.length === 0) {
    return entries;
  }

  const client = createServiceClient();
  for (const batch of budgetedBatches(normalizedKeys)) {
    const { data, error } = await client
      .from("merchant_dictionary")
      .select("merchant_key, account_code, default_verdict, reason")
      .in("merchant_key", batch);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as DictionaryRow[]) {
      entries.set(row.merchant_key, {
        merchantKey: row.merchant_key,
        accountCode: row.account_code,
        defaultVerdict: row.default_verdict,
        reason: row.reason,
      });
    }
  }

  return entries;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDictionaryVerdict(value: unknown): value is DictionaryVerdict {
  return value === "expense" || value === "personal";
}

function isValidReason(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.length <= MAX_REASON_LENGTH &&
      !/[\r\n]/u.test(value))
  );
}

function toDictionaryRow(value: unknown, updatedAt: string): DictionaryRow & {
  updated_at: string;
} | null {
  if (
    !isRecord(value) ||
    typeof value.merchantKey !== "string" ||
    !isAccountCode(value.accountCode) ||
    !isDictionaryVerdict(value.defaultVerdict) ||
    !isValidReason(value.reason)
  ) {
    return null;
  }

  const key = merchantKey(value.merchantKey);
  if (!key) {
    return null;
  }

  return {
    merchant_key: key,
    account_code: value.accountCode,
    default_verdict: value.defaultVerdict,
    reason: value.reason,
    updated_at: updatedAt,
  };
}

export async function upsertMerchants(
  entries: unknown[],
): Promise<{ inserted: number; rejected: number }> {
  if (entries.length === 0) {
    return { inserted: 0, rejected: 0 };
  }

  const updatedAt = new Date().toISOString();
  const validRows = entries.flatMap((entry) => {
    const row = toDictionaryRow(entry, updatedAt);
    return row ? [row] : [];
  });
  const rejected = entries.length - validRows.length;

  if (validRows.length === 0) {
    return { inserted: 0, rejected };
  }

  const { error } = await createServiceClient()
    .from("merchant_dictionary")
    .upsert(validRows, { onConflict: "merchant_key" });

  if (error) {
    throw error;
  }

  return { inserted: validRows.length, rejected };
}
