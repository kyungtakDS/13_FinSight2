import { createServiceClient } from "@/lib/supabase/service";
import { isAccountCode, type AccountCode } from "@/types/account-codes";

const LOOKUP_BATCH_SIZE = 500;
const MAX_REASON_LENGTH = 500;

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
  for (
    let offset = 0;
    offset < normalizedKeys.length;
    offset += LOOKUP_BATCH_SIZE
  ) {
    const batch = normalizedKeys.slice(offset, offset + LOOKUP_BATCH_SIZE);
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
