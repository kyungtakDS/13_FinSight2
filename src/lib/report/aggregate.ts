import {
  ACCOUNT_CODES,
  accountLabel,
  type AccountCode,
} from "@/types/account-codes";
import type {
  AccountBreakdown,
  Insight,
  UploadSummary,
} from "@/types/report";
import type { ClassifiedTxn } from "@/types/transaction";

export const ESTIMATED_TAX_RATE = 0.066;

const accountOrder = new Map<AccountCode, number>(
  ACCOUNT_CODES.map(({ code }, index) => [code, index]),
);

interface AccountAccumulator {
  total: number;
  count: number;
}

function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function createInsights(
  txns: ClassifiedTxn[],
  accounts: AccountBreakdown[],
  expenseTotal: number,
  personalTotal: number,
  uncertainCount: number,
  uncertainTotal: number,
): Insight[] {
  if (txns.length === 0) {
    return [];
  }

  const insights: Insight[] = [];

  if (uncertainCount > 0) {
    insights.push({
      id: "uncertain",
      title: `애매한 거래 ${uncertainCount.toLocaleString("ko-KR")}건`,
      body: `분류가 애매한 거래 ${formatWon(uncertainTotal)}은 예상 절감액에서 제외했습니다. 세무대리인과 별도로 확인해 주세요.`,
    });
  }

  const largestAccount = accounts[0];
  if (largestAccount) {
    const percentage =
      expenseTotal > 0 ? Math.floor(largestAccount.ratio * 100) : 0;
    insights.push({
      id: "largest-account",
      title: `가장 큰 계정과목은 ${largestAccount.label}`,
      body: `경비 처리 가능성이 높은 항목 중 ${formatWon(largestAccount.total)}으로, 순경비 후보 금액의 ${percentage.toLocaleString("ko-KR")}%입니다.`,
    });
  }

  const cancellationTotal = txns.reduce(
    (sum, transaction) =>
      transaction.amount < 0 ? sum + -transaction.amount : sum,
    0,
  );
  if (cancellationTotal > 0) {
    insights.push({
      id: "cancellations",
      title: "취소·부분취소 금액 반영",
      body: `${formatWon(cancellationTotal)}을 원래 부호대로 합계에 상계했습니다.`,
    });
  }

  const classifiedTotal = expenseTotal + personalTotal;
  if (classifiedTotal > 0) {
    const expenseRatio = Math.floor((expenseTotal / classifiedTotal) * 100);
    insights.push({
      id: "expense-ratio",
      title: "경비 후보 비율",
      body: `분류된 순지출 중 경비 처리 가능성이 높은 항목은 ${expenseRatio.toLocaleString("ko-KR")}%입니다.`,
    });
  }

  return insights;
}

export function aggregate(txns: ClassifiedTxn[]): UploadSummary {
  let expenseTotal = 0;
  let personalTotal = 0;
  let uncertainCount = 0;
  let uncertainTotal = 0;
  const accountTotals = new Map<AccountCode, AccountAccumulator>();

  for (const transaction of txns) {
    if (transaction.verdict === "personal") {
      personalTotal += transaction.amount;
      continue;
    }

    if (
      transaction.verdict === "uncertain" ||
      transaction.accountCode === null
    ) {
      uncertainCount += 1;
      uncertainTotal += transaction.amount;
      continue;
    }

    expenseTotal += transaction.amount;
    const current = accountTotals.get(transaction.accountCode) ?? {
      total: 0,
      count: 0,
    };
    accountTotals.set(transaction.accountCode, {
      total: current.total + transaction.amount,
      count: current.count + 1,
    });
  }

  const accounts = [...accountTotals.entries()]
    .map(([code, value]): AccountBreakdown => ({
      code,
      label: accountLabel(code),
      total: value.total,
      count: value.count,
      ratio: expenseTotal === 0 ? 0 : value.total / expenseTotal,
    }))
    .sort(
      (left, right) =>
        right.total - left.total ||
        accountOrder.get(left.code)! - accountOrder.get(right.code)!,
    );

  const estimatedSaving =
    expenseTotal > 0
      ? Math.floor(expenseTotal * ESTIMATED_TAX_RATE)
      : 0;

  return {
    expenseTotal,
    personalTotal,
    uncertainCount,
    uncertainTotal,
    estimatedSaving,
    taxRate: ESTIMATED_TAX_RATE,
    accounts,
    insights: createInsights(
      txns,
      accounts,
      expenseTotal,
      personalTotal,
      uncertainCount,
      uncertainTotal,
    ),
    txnCount: txns.length,
  };
}

export function txnPeriod(
  txns: ClassifiedTxn[],
): { start: string | null; end: string | null } {
  if (txns.length === 0) {
    return { start: null, end: null };
  }

  let start = txns[0]!.txnDate;
  let end = start;

  for (let index = 1; index < txns.length; index += 1) {
    const date = txns[index]!.txnDate;
    if (date < start) {
      start = date;
    }
    if (date > end) {
      end = date;
    }
  }

  return { start, end };
}
