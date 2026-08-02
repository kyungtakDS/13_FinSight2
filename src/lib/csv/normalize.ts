import iconv from "iconv-lite";
import Papa from "papaparse";

import type { ColumnMap } from "@/types/csv";
import type { NormalizedTxn } from "@/types/transaction";

export type CsvEncoding = "utf-8" | "cp949";

const MAX_TRANSACTION_ROWS = 3_000;

export class RowLimitExceeded extends Error {
  constructor() {
    super("row_limit_exceeded");
    this.name = "RowLimitExceeded";
  }
}

export function detectEncoding(bytes: Uint8Array): CsvEncoding {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "utf-8";
  } catch {
    return "cp949";
  }
}

export function decodeCsv(
  bytes: Uint8Array,
  encoding: CsvEncoding,
): string {
  const decoded =
    encoding === "cp949"
      ? iconv.decode(Buffer.from(bytes), "cp949")
      : new TextDecoder("utf-8").decode(bytes);

  return decoded.replace(/^\uFEFF/, "");
}

export function parseRows(text: string): string[][] {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
  });

  return result.data;
}

export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") {
    return null;
  }

  const parenthesesNegative =
    trimmed.startsWith("(") && trimmed.endsWith(")");
  const markerNegative = /^[△▲]/u.test(trimmed);
  const leadingNegative = /^-/u.test(trimmed);
  const negative = parenthesesNegative || markerNegative || leadingNegative;
  const numeric = trimmed
    .replace(/[(),\s₩원△▲]/gu, "")
    .replace(/^[^\d.+-]+/u, "")
    .replace(/[^\d.+-]+$/u, "");

  if (!/^[+-]?\d+(?:\.\d+)?$/u.test(numeric)) {
    return null;
  }

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const integer = Math.trunc(Math.abs(parsed)) * (negative ? -1 : 1);
  return Number.isSafeInteger(integer) ? integer : null;
}

export function parseTxnDate(raw: string): string | null {
  const match = raw
    .trim()
    .match(/^(\d{4})(?:[./-]?)(\d{2})(?:[./-]?)(\d{2})(?:\s|$)/u);
  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
}

export function normalizeMerchant(raw: string): string {
  return raw
    .replace(/\b\d{4}-\d{2}[*\d]{2}-[*\d]{4}-\d{4}\b/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function normalizeRows(
  rows: string[][],
  map: ColumnMap,
  headerRowIndex: number,
): { txns: NormalizedTxn[]; skipped: number } {
  const transactionRows = rows.slice(headerRowIndex + 1);
  if (transactionRows.length > MAX_TRANSACTION_ROWS) {
    throw new RowLimitExceeded();
  }

  const txns: NormalizedTxn[] = [];
  let skipped = 0;

  for (let offset = 0; offset < transactionRows.length; offset += 1) {
    const row = transactionRows[offset];
    const txnDate = parseTxnDate(row?.[map.date] ?? "");
    const merchant = normalizeMerchant(row?.[map.merchant] ?? "");
    const amount = parseAmount(row?.[map.amount] ?? "");

    if (txnDate === null || merchant === "" || amount === null) {
      skipped += 1;
      continue;
    }

    txns.push({
      rowIndex: headerRowIndex + 1 + offset,
      txnDate,
      merchant,
      amount,
    });
  }

  return { txns, skipped };
}
