import { notFound } from "next/navigation";

import { AccountDonut } from "@/components/report/AccountDonut";
import { Disclaimer } from "@/components/report/Disclaimer";
import { FailedPanel } from "@/components/report/FailedPanel";
import { InsightList } from "@/components/report/InsightList";
import { LockedTable } from "@/components/report/LockedTable";
import { MetricRow } from "@/components/report/MetricRow";
import { ProcessingPanel } from "@/components/report/ProcessingPanel";
import { RecomputePanel } from "@/components/report/RecomputePanel";
import { ReportHeader } from "@/components/report/ReportHeader";
import { SavingsHero } from "@/components/report/SavingsHero";
import { StatusPoller } from "@/components/report/StatusPoller";
import { TransactionTable, type ReportTransaction } from "@/components/report/TransactionTable";
import { UncertainBanner } from "@/components/report/UncertainBanner";
import { gateReport, viewScope } from "@/lib/gate";
import { createClient, getUser } from "@/lib/supabase/server";
import { getProfilePlan, getUploadForUser, isRecomputing } from "@/lib/supabase/service";

type UploadPageProps = { params: Promise<{ id: string }> };

async function fetchTransactionsForUser(userId: string, uploadId: string): Promise<ReportTransaction[]> {
  const client = await createClient();
  const { data, error } = await client.from("transactions")
    .select("row_index, txn_date, merchant, amount, account_code, verdict")
    .eq("user_id", userId).eq("upload_id", uploadId).order("row_index", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const merchantKeys = [...new Set(rows.map((row) => row.merchant as string))];
  const reasons = new Map<string, string>();
  if (merchantKeys.length > 0) {
    const { data: dictionary, error: dictionaryError } = await client.from("merchant_dictionary")
      .select("merchant_key, reason").in("merchant_key", merchantKeys);
    if (dictionaryError) throw dictionaryError;
    for (const item of dictionary ?? []) {
      if (typeof item.reason === "string") reasons.set(item.merchant_key as string, item.reason);
    }
  }

  return rows.map((row) => ({
    rowIndex: row.row_index as number,
    txnDate: row.txn_date as string,
    merchant: row.merchant as string,
    amount: row.amount as number,
    accountCode: row.account_code as ReportTransaction["accountCode"],
    verdict: row.verdict as ReportTransaction["verdict"],
    reason: reasons.get(row.merchant as string),
  }));
}

export default async function UploadPage({ params }: UploadPageProps) {
  const user = await getUser();
  if (!user) notFound();

  const { id } = await params;
  const upload = await getUploadForUser(user.id, id);
  if (!upload) notFound();

  if (upload.status === "processing") {
    return <><ProcessingPanel /><StatusPoller uploadId={id} status="processing" /></>;
  }

  if (upload.status === "failed") {
    // Server render 시점에 원본 보관 기한이 지났는지 판정한다.
    // eslint-disable-next-line react-hooks/purity
    const originalExpired = new Date(upload.expiresAt).getTime() <= Date.now();
    return (
      <FailedPanel
        uploadId={id}
        errorCode={originalExpired ? "expired" : upload.errorCode}
        retriesLeft={Math.max(0, 2 - upload.retryCount)}
      />
    );
  }

  if (!upload.summary) throw new Error("completed upload missing summary");
  const plan = await getProfilePlan(user.id);
  const scope = viewScope(plan);
  const transactions = scope.canViewTransactions ? await fetchTransactionsForUser(user.id, id) : [];
  const report = gateReport(plan, upload.summary, transactions);
  if (!scope.canViewTransactions) report.lockedTxnCount = upload.rowCount ?? 0;
  const { summary } = report;
  // 원본 보관 기한이 지났는지 server render 시점에 판정한다 — 파기된 뒤에는
  // 눌러도 409 만 돌아오므로 버튼 자체를 내지 않는다.
  // eslint-disable-next-line react-hooks/purity
  const canRecompute = Boolean(upload.storagePath) && new Date(upload.expiresAt).getTime() > Date.now();

  return <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
    <ReportHeader periodStart={upload.periodStart} periodEnd={upload.periodEnd} txnCount={summary.txnCount} />
    <SavingsHero estimatedSaving={summary.estimatedSaving} taxRate={summary.taxRate} />
    <MetricRow expenseTotal={summary.expenseTotal} personalTotal={summary.personalTotal} uncertainTotal={summary.uncertainTotal} />
    <UncertainBanner uncertainCount={summary.uncertainCount} />
    <InsightList insights={summary.insights} />
    <AccountDonut accounts={summary.accounts} txnCount={summary.txnCount} />
    {scope.canViewTransactions
      ? <TransactionTable transactions={report.transactions} />
      : <LockedTable lockedCount={report.lockedTxnCount} />}
    <RecomputePanel uploadId={id} canRecompute={canRecompute} recomputing={isRecomputing(upload.recomputeStartedAt)} />
    <Disclaimer />
  </div>;
}
