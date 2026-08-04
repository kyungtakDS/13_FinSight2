import Link from "next/link";

const skeletonRows = Array.from({ length: 6 }, (_, index) => index);
const skeletonColumns = Array.from({ length: 6 }, (_, index) => index);

export function LockedTable({ lockedCount }: { lockedCount: number }) {
  return <section aria-labelledby="locked-table-title">
    <h2 id="locked-table-title" className="fs-h">거래별 분류 내역</h2>
    <div className="fs-lockwrap">
      <div className="fs-lockblur fs-tablewrap" aria-hidden="true">
        <table className="fs-table"><tbody>
          {skeletonRows.map((row) => <tr key={row}>
            {skeletonColumns.map((column) => <td key={column}>
              <span style={{ display: "block", height: "var(--space-sm)", borderRadius: "var(--radius-pill)", background: "var(--color-surface-soft)" }} />
            </td>)}
          </tr>)}
        </tbody></table>
      </div>
      <div className="fs-lockscrim">
        <p style={{ fontWeight: 540 }}>거래 {lockedCount.toLocaleString("ko-KR")}건의 계정과목 · 경비 판정 · 판정 근거가 잠겨 있습니다</p>
        <p className="fs-muted">세무사 전달용 파일 다운로드도 Pro에서 열립니다</p>
        <Link href="/upgrade" style={{ display: "inline-flex", minHeight: "var(--space-xxl)", alignItems: "center", padding: "var(--space-xs) var(--space-lg)", borderRadius: "var(--radius-pill)", background: "var(--fs-accent)", color: "var(--fs-accent-ink)", fontWeight: 480 }}>
          Pro 시작하기
        </Link>
      </div>
    </div>
  </section>;
}
