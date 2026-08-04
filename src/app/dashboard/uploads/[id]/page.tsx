import { notFound } from "next/navigation";

import { AccountDonut } from "@/components/report/AccountDonut";
import { Disclaimer } from "@/components/report/Disclaimer";
import { FailedPanel } from "@/components/report/FailedPanel";
import { InsightList } from "@/components/report/InsightList";
import { MetricRow } from "@/components/report/MetricRow";
import { ProcessingPanel } from "@/components/report/ProcessingPanel";
import { ReportHeader } from "@/components/report/ReportHeader";
import { SavingsHero } from "@/components/report/SavingsHero";
import { StatusPoller } from "@/components/report/StatusPoller";
import { UncertainBanner } from "@/components/report/UncertainBanner";
import { gateReport } from "@/lib/gate";
import { getUser } from "@/lib/supabase/server";
import { getProfilePlan, getUploadForUser } from "@/lib/supabase/service";

type UploadPageProps = { params: Promise<{ id: string }> };

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
  const { summary } = gateReport(plan, upload.summary, []);

  return <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)" }}>
    <ReportHeader periodStart={upload.periodStart} periodEnd={upload.periodEnd} txnCount={summary.txnCount} />
    <SavingsHero estimatedSaving={summary.estimatedSaving} taxRate={summary.taxRate} />
    <MetricRow expenseTotal={summary.expenseTotal} personalTotal={summary.personalTotal} uncertainTotal={summary.uncertainTotal} />
    <UncertainBanner uncertainCount={summary.uncertainCount} />
    <InsightList insights={summary.insights} />
    <AccountDonut accounts={summary.accounts} txnCount={summary.txnCount} />
    <section aria-label="거래별 분류 내역" data-step="report-table-lock" />
    <Disclaimer />
  </div>;
}
