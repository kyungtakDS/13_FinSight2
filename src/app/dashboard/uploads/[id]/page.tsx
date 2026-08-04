import { notFound } from "next/navigation";

import { FailedPanel } from "@/components/report/FailedPanel";
import { ProcessingPanel } from "@/components/report/ProcessingPanel";
import { StatusPoller } from "@/components/report/StatusPoller";
import { getUser } from "@/lib/supabase/server";
import { getUploadForUser } from "@/lib/supabase/service";

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

  return (
    <section className="fs-card" aria-labelledby="report-placeholder-title">
      <span className="fs-eyebrow">분석 완료</span>
      <h1 id="report-placeholder-title" className="fs-page-title">리포트 준비가 완료되었습니다</h1>
      <p className="fs-muted">리포트 내용은 다음 단계에서 표시됩니다.</p>
    </section>
  );
}
