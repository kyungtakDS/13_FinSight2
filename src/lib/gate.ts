import type { GatedReport, UploadSummary } from "@/types/report";
import type { ClassifiedTxn } from "@/types/transaction";

export type Plan = "free" | "pro";

export interface ViewScope {
  canViewTransactions: boolean;
  insightLimit: number | null;
  canExport: boolean;
}

const FREE_SCOPE: ViewScope = {
  canViewTransactions: false,
  insightLimit: 3,
  canExport: false,
};

const PRO_SCOPE: ViewScope = {
  canViewTransactions: true,
  insightLimit: null,
  canExport: true,
};

export function viewScope(plan: Plan): ViewScope {
  return plan === "pro" ? PRO_SCOPE : FREE_SCOPE;
}

/** Creates the client payload without including data outside the plan's scope. */
export function gateReport(
  plan: Plan,
  summary: UploadSummary,
  txns: ClassifiedTxn[],
): GatedReport {
  const scope = viewScope(plan);
  const gatedInsights =
    scope.insightLimit === null
      ? [...summary.insights]
      : summary.insights.slice(0, scope.insightLimit);

  return {
    summary: {
      ...summary,
      insights: gatedInsights,
    },
    transactions: scope.canViewTransactions ? [...txns] : [],
    lockedTxnCount: scope.canViewTransactions ? 0 : txns.length,
    canExport: scope.canExport,
  };
}
