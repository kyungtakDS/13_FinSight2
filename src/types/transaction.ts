import type { AccountCode } from "./account-codes";

export const VERDICTS = Object.freeze([
  "expense",
  "personal",
  "uncertain",
] as const);

export type Verdict = (typeof VERDICTS)[number];

export function isVerdict(value: unknown): value is Verdict {
  return (
    typeof value === "string" &&
    (VERDICTS as readonly string[]).includes(value)
  );
}

/** CSV 정규화 결과. 아직 분류되지 않은 상태. */
export interface NormalizedTxn {
  /** 원본 행 번호. 정합성 검사용. */
  rowIndex: number;
  /** YYYY-MM-DD 형식의 거래일. */
  txnDate: string;
  /** 정규화된 상호명. */
  merchant: string;
  /** 원 단위 정수. 취소는 음수로 부호를 보존한다. */
  amount: number;
}

/** 분류까지 끝난 거래. */
export interface ClassifiedTxn extends NormalizedTxn {
  accountCode: AccountCode | null;
  verdict: Verdict;
}

/** transactions 테이블의 행. */
export interface TransactionRow extends ClassifiedTxn {
  id: number;
  uploadId: string;
  userId: string;
}
