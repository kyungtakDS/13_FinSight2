import iconv from "iconv-lite";
import Papa from "papaparse";

import type { ColumnMap, TxnTypeKind } from "@/types/csv";
import type { NormalizedTxn } from "@/types/transaction";

export type CsvEncoding = "utf-8" | "cp949";

const MAX_TRANSACTION_ROWS = 3_000;

/**
 * 상태 컬럼으로 인정하는 고유 값의 상한. 이보다 많으면 상태가 아니라 자유 텍스트를
 * 가리키는 오매핑으로 본다. 상한이 필요한 이유는 그 값들이 모델 프롬프트로 나가고
 * 사용자 간 공유되는 매핑 캐시에 저장되기 때문이다 — 가맹점명 컬럼을 잘못 물면
 * 상호명이 전역 캐시에 그대로 쌓인다.
 */
export const MAX_STATUS_VALUES = 20;

export class RowLimitExceeded extends Error {
  constructor() {
    super("row_limit_exceeded");
    this.name = "RowLimitExceeded";
  }
}

/**
 * 데이터 행은 있는데 거래로 읽어낸 행이 하나도 없는 상태. 파일을 못 읽은 것과는
 * 다르다 — 파일은 읽혔고 날짜·가맹점·금액 해석에서 전부 떨어진 것이다.
 */
export class RowsUnreadable extends Error {
  constructor() {
    super("rows_unreadable");
    this.name = "RowsUnreadable";
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

/**
 * 카드사마다 날짜 표기가 다르다. 구분자가 있는 형태는 `년/월/일` 까지 받고 한
 * 자리 월·일도 허용한다. 구분자가 없는 형태는 여덟 자리만 날짜로 본다 — 여기서
 * 한 자리를 허용하면 `202612` 같은 여섯 자리 숫자가 날짜로 둔갑해, 금액이나
 * 번호 컬럼이 날짜 컬럼으로 뽑혀도 걸러지지 않는다.
 *
 * 날짜 뒤에 시간이 붙는 형태는 공백으로 끊기면 지원한다 (기존 계약 그대로).
 */
const DATE_PATTERNS = [
  /^(\d{4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})일?(?=\s|$)/u,
  /^(\d{4})(\d{2})(\d{2})(?=\s|$)/u,
];

export function parseTxnDate(raw: string): string | null {
  const text = raw.trim();
  let match: RegExpMatchArray | null = null;
  for (const pattern of DATE_PATTERNS) {
    match = text.match(pattern);
    if (match) {
      break;
    }
  }
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  // 한 자리 월·일을 받으므로 출력에서 0 을 채운다. 그러지 않으면 `2026-6-5` 가
  // 저장되어 문자열 비교로 기간을 구하는 곳이 전부 어긋난다.
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeMerchant(raw: string): string {
  return raw
    .replace(/\b\d{4}-\d{2}[*\d]{2}-[*\d]{4}-\d{4}\b/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function statusCell(row: string[] | undefined, map: ColumnMap): string {
  return map.txnType === null ? "" : (row?.[map.txnType] ?? "").trim();
}

/**
 * 상태 컬럼의 고유 값. 사전을 만들 때만 쓴다. 상태 컬럼이 없거나 값이 너무 많으면
 * 빈 배열이고, 그러면 호출자는 사전 없이 진행한다 — 사전이 없으면 모든 행이 normal 이다.
 */
export function collectStatusValues(
  rows: string[][],
  map: ColumnMap,
  headerRowIndex: number,
): string[] {
  if (map.txnType === null) {
    return [];
  }

  const values = new Set<string>();
  for (const row of rows.slice(headerRowIndex + 1)) {
    const value = statusCell(row, map);
    if (value !== "") {
      values.add(value);
    }
    if (values.size > MAX_STATUS_VALUES) {
      return [];
    }
  }

  return [...values];
}

export function normalizeRows(
  rows: string[][],
  map: ColumnMap,
  headerRowIndex: number,
): { txns: NormalizedTxn[]; skipped: number; excluded: number } {
  const transactionRows = rows.slice(headerRowIndex + 1);
  if (transactionRows.length > MAX_TRANSACTION_ROWS) {
    throw new RowLimitExceeded();
  }

  const txns: NormalizedTxn[] = [];
  let skipped = 0;
  let excluded = 0;

  for (let offset = 0; offset < transactionRows.length; offset += 1) {
    const row = transactionRows[offset];
    const txnDate = parseTxnDate(row?.[map.date] ?? "");
    const merchant = normalizeMerchant(row?.[map.merchant] ?? "");
    const amount = parseAmount(row?.[map.amount] ?? "");

    if (txnDate === null || merchant === "" || amount === null) {
      skipped += 1;
      continue;
    }

    const kind: TxnTypeKind = map.txnTypeRules?.[statusCell(row, map)] ?? "normal";

    // 승인이 취소된 건은 청구되지 않았으므로 상계할 원거래가 없다. 음수로 넣으면
    // 존재하지 않는 환급이 다른 거래에서 깎인다.
    if (kind === "void") {
      excluded += 1;
      continue;
    }

    txns.push({
      rowIndex: headerRowIndex + 1 + offset,
      txnDate,
      merchant,
      // 0원 취소 행이 실제로 있다. 단항 부호 반전은 -0 을 만들어 저장되므로 뺄셈으로 뒤집는다.
      amount: kind === "reversal" ? 0 - amount : amount,
    });
  }

  return { txns, skipped, excluded };
}
