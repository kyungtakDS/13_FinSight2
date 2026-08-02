export interface ColumnMap {
  date: number;
  merchant: number;
  amount: number;
  /** 취소/승인 구분 컬럼이 따로 있는 양식용. */
  txnType: number | null;
}

/** csv_format_mappings 테이블의 행. */
export interface CsvFormatMapping {
  headerFingerprint: string;
  columnMap: ColumnMap;
  headerRowIndex: number;
  encoding: "utf-8" | "cp949";
}
