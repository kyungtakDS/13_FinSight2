import type { AccountCode } from "./account-codes";
import type { ClassifiedTxn } from "./transaction";

export interface AccountBreakdown {
  code: AccountCode;
  label: string;
  total: number;
  count: number;
  ratio: number;
}

/** 서버가 결정적으로 생성하는 인사이트. */
export interface Insight {
  id: string;
  title: string;
  body: string;
}

export interface UploadSummary {
  expenseTotal: number;
  personalTotal: number;
  uncertainCount: number;
  uncertainTotal: number;
  estimatedSaving: number;
  taxRate: number;
  accounts: AccountBreakdown[];
  insights: Insight[];
  txnCount: number;
}

/** 서버 게이트를 통과해 클라이언트로 나가는 리포트. */
export interface GatedReport {
  summary: Omit<UploadSummary, "insights"> & { insights: Insight[] };
  transactions: ClassifiedTxn[];
  lockedTxnCount: number;
  canExport: boolean;
}
