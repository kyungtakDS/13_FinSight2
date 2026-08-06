/**
 * 거래 상태의 의미. `void` 는 승인이 취소되어 청구되지 않은 건이라 합계에서 빼는
 * 게 아니라 아예 제외하고, `reversal` 은 이미 매입된 거래를 되돌리는 건이라
 * 음수로 상계한다 (ADR-014).
 */
export type TxnTypeKind = "normal" | "void" | "reversal";

export interface ColumnMap {
  date: number;
  merchant: number;
  amount: number;
  /** 취소/승인 구분 컬럼이 따로 있는 양식용. */
  txnType: number | null;
  /**
   * txnType 컬럼의 원본 값 → 의미. 카드사마다 문자열이 다르므로 코드가 아니라
   * 모델이 양식별로 한 번 판정해 채우고 매핑 캐시에 함께 실린다. 사전에 없는
   * 값과 사전 자체가 없는 옛 캐시는 전부 normal 로 읽는다.
   */
  txnTypeRules?: Record<string, TxnTypeKind>;
}

/** csv_format_mappings 테이블의 행. */
export interface CsvFormatMapping {
  headerFingerprint: string;
  columnMap: ColumnMap;
  headerRowIndex: number;
  encoding: "utf-8" | "cp949";
}
