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
  excludedCount: number,
  statusUnresolved: boolean,
  skippedCount: number,
): Insight[] {
  if (txns.length === 0) {
    return [];
  }

  const insights: Insight[] = [];

  // 명세서 건수와 리포트 건수가 어긋나는 두 번째 이유다. 첫째는 voided 이고
  // 이건 아예 읽지 못한 행이라, 밝히지 않으면 사용자는 차이를 설명할 수 없다.
  if (skippedCount > 0) {
    const inputRows = txns.length + excludedCount + skippedCount;
    insights.push({
      id: "skipped-rows",
      title: `해석하지 못한 행 ${skippedCount.toLocaleString("ko-KR")}건`,
      body: `명세서 ${inputRows.toLocaleString("ko-KR")}행 중 ${txns.length.toLocaleString("ko-KR")}건을 거래로 읽었고, ${skippedCount.toLocaleString("ko-KR")}건은 날짜·가맹점·금액을 해석하지 못해 제외했습니다.`,
    });
  }

  // 취소 판정에 실패하면 취소 건이 정상 거래로 합계에 들어간다. 세무 자료에서
  // 과대계상은 누락보다 위험하므로 조용히 넘어가지 않는다 (ADR-014).
  if (statusUnresolved) {
    insights.push({
      id: "status-unresolved",
      title: "취소 상태를 판정하지 못한 거래가 있습니다",
      body: "일부 거래의 취소 상태를 판정하지 못해 정상 거래로 포함했을 수 있습니다. 세무대리인과 함께 확인해 주세요.",
    });
  }

  if (uncertainCount > 0) {
    insights.push({
      id: "uncertain",
      title: `애매한 거래 ${uncertainCount.toLocaleString("ko-KR")}건`,
      body: `분류가 애매한 거래 ${formatWon(uncertainTotal)}은 예상 절감액에서 제외했습니다. 세무대리인과 별도로 확인해 주세요.`,
    });
  }

  // 제외된 행은 거래 내역에도 세무사 파일에도 없다. 명세서 건수와 리포트 건수가
  // 어긋나는 이유가 여기 말고는 드러나지 않으므로 건수를 밝힌다.
  if (excludedCount > 0) {
    insights.push({
      id: "voided",
      title: `취소된 거래 ${excludedCount.toLocaleString("ko-KR")}건 제외`,
      body: "승인이 취소되어 청구되지 않은 거래는 명세서에 남아 있어도 합계와 거래 내역에서 제외했습니다.",
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

/**
 * `excludedCount` 는 정규화 단계에서 제외된 승인취소 행 수다. 합계에는 들어가지
 * 않으므로 거래 배열로는 전달할 수 없고, 인사이트에만 쓰인다. `statusUnresolved`
 * 는 상태값 판정에 실패해 취소 여부를 모르는 거래가 섞였다는 뜻이다.
 */
export function aggregate(
  txns: ClassifiedTxn[],
  excludedCount = 0,
  statusUnresolved = false,
  skippedCount = 0,
): UploadSummary {
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
      excludedCount,
      statusUnresolved,
      skippedCount,
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
