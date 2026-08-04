"use client";

import type { CsvPreview } from "@/lib/csv/preview";

type DetectCardProps = CsvPreview & { filename: string };

function DetectRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fs-detect-row">
      <span className="k">{label}</span>
      <span className="v">{children}</span>
    </div>
  );
}

export function DetectCard({
  filename,
  issuerHint,
  encoding,
  rowCount,
  headerLabels,
}: DetectCardProps) {
  return (
    <section aria-labelledby="detect-title">
      <span className="fs-eyebrow">자동 미리보기</span>
      <h2 id="detect-title" className="fs-page-title">이 파일을 이렇게 읽었습니다</h2>
      <p className="fs-muted">서버에서 컬럼 구조를 다시 확인한 뒤 분석합니다.</p>
      <div className="fs-card">
        <h3 className="fs-h">{filename}</h3>
        <DetectRow label="카드사">{issuerHint ?? "서버에서 판별"}</DetectRow>
        <DetectRow label="인코딩">{encoding}</DetectRow>
        <DetectRow label="행 수"><span className="num">{rowCount.toLocaleString("ko-KR")}행</span></DetectRow>
        <DetectRow label="컬럼 매핑">
          {headerLabels?.join(" · ") ?? "서버에서 판별"}
        </DetectRow>
        <DetectRow label="민감정보 제거">카드번호·승인번호는 저장하지 않습니다</DetectRow>
      </div>
    </section>
  );
}
