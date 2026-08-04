import { Footer } from "@/components/marketing/Footer";
import { LandingNav } from "@/components/marketing/LandingNav";

const pageStyle = {
  background: "var(--color-canvas)",
  color: "var(--color-ink)",
} as const;

const documentStyle = {
  margin: "0 auto",
  maxWidth: "var(--container-max)",
  padding: "var(--space-section) var(--space-lg)",
} as const;

const sectionStyle = {
  borderTop: "var(--space-hair) solid var(--color-hairline)",
  padding: "var(--space-xxl) 0",
} as const;

const subsectionStyle = {
  display: "grid",
  gap: "var(--space-md)",
  marginTop: "var(--space-xl)",
} as const;

const listStyle = {
  display: "grid",
  gap: "var(--space-sm)",
  margin: 0,
  paddingLeft: "var(--space-lg)",
} as const;

export default function LegalPage() {
  return (
    <main style={pageStyle}>
      <LandingNav />
      <article style={documentStyle}>
        <header style={{ display: "grid", gap: "var(--space-md)", paddingBottom: "var(--space-xxl)" }}>
          <p className="t-eyebrow" style={{ margin: 0 }}>LEGAL</p>
          <h1 className="t-display-lg" style={{ margin: 0 }}>이용약관 및 정책</h1>
          <p className="t-body" style={{ margin: 0 }}>이 문서는 법률 전문가 검토 전 초안입니다.</p>
          <p className="t-caption" style={{ margin: 0 }}>최종 개정일: 2026년 8월 4일</p>
          <nav aria-label="문서 목차">
            <ol className="t-body" style={listStyle}>
              <li><a href="#terms" style={{ color: "var(--color-ink)" }}>이용약관</a></li>
              <li><a href="#privacy" style={{ color: "var(--color-ink)" }}>개인정보처리방침</a></li>
              <li><a href="#tax" style={{ color: "var(--color-ink)" }}>세무 고지</a></li>
            </ol>
          </nav>
        </header>

        <section aria-labelledby="terms" style={sectionStyle}>
          <h2 className="t-headline" id="terms" style={{ margin: 0 }}>이용약관</h2>

          <div style={subsectionStyle}>
            <h3 className="t-subhead" style={{ margin: 0 }}>서비스와 파일 조건</h3>
            <p className="t-body" style={{ margin: 0 }}>
              FinSight는 카드 명세서를 분석해 경비 후보와 참고용 리포트를 만드는 서비스입니다. 업로드는 CSV only이며 파일당 최대 2MB, 3,000행까지 지원합니다. XLSX와 PDF는 CSV로 변환한 뒤 업로드해야 합니다.
            </p>
          </div>

          <div style={subsectionStyle}>
            <h3 className="t-subhead" style={{ margin: 0 }}>구독과 종료 후 접근</h3>
            <p className="t-body" style={{ margin: 0 }}>
              Pro는 월 반복청구 구독이며 해지·환불은 Polar 고객 포털에서 관리합니다.
            </p>
            <ul className="t-body" style={listStyle}>
              <li>해지 후에도 데이터를 지우지 않습니다.</li>
              <li>유료 화면인 전체 분류 내역과 다운로드는 다시 잠깁니다.</li>
              <li>무료 화면은 과거 분석 전부에 계속 열립니다.</li>
              <li>이미 다운로드한 파일은 회수하지 않습니다.</li>
              <li>재구독하면 즉시 전부 다시 열립니다.</li>
            </ul>
          </div>
        </section>

        <section aria-labelledby="privacy" style={sectionStyle}>
          <h2 className="t-headline" id="privacy" style={{ margin: 0 }}>개인정보처리방침</h2>

          <div style={subsectionStyle}>
            <h3 className="t-subhead" style={{ margin: 0 }}>수집·저장과 인증</h3>
            <p className="t-body" style={{ margin: 0 }}>
              인증은 Google 단독입니다. 서비스는 이메일, 거래 내역(날짜·상호명·금액), 계정과목, 판정을 저장합니다. 카드번호·승인번호는 저장하지 않습니다.
            </p>
            <p className="t-body" style={{ margin: 0 }}>
              원본 CSV는 비공개 버킷에 암호화 저장하고 90일 후 자동 삭제합니다. 90일 후 사라지는 것은 원본 파일뿐이며 거래 내역과 리포트는 남습니다. 계정 삭제 시에는 즉시 전량 파기합니다.
            </p>
          </div>

          <div style={subsectionStyle}>
            <h3 className="t-subhead" style={{ margin: 0 }}>Anthropic 전송 범위와 공유 자산</h3>
            <p className="t-body" style={{ margin: 0 }}>
              Anthropic으로 나가는 것은 ① CSV 상위 20행 ② 가맹점 상호명뿐입니다. 금액·날짜·카드번호·사용자 식별자는 전송하지 않습니다. 누가 언제 얼마를 썼는지는 서버 밖으로 나가지 않습니다.
            </p>
            <p className="t-body" style={{ margin: 0 }}>
              merchant_dictionary와 csv_format_mappings는 개인정보를 담지 않는 전역 공유 자산입니다. 각각 정규화된 상호명의 분류 정보와 CSV 헤더 구조의 매핑 정보를 저장합니다.
            </p>
          </div>
        </section>

        <section aria-labelledby="tax" style={sectionStyle}>
          <h2 className="t-headline" id="tax" style={{ margin: 0 }}>세무 고지</h2>

          <div style={subsectionStyle}>
            <h3 className="t-subhead" style={{ margin: 0 }}>서비스의 위치</h3>
            <p className="t-body" style={{ margin: 0 }}>
              FinSight는 경비 후보 정리 도구입니다. 거래를 경비 처리 가능성이 높은 항목, 개인 지출, 애매한 항목으로 정리해 세무사에게 전달할 자료를 만듭니다.
            </p>
          </div>

          <div style={subsectionStyle}>
            <h3 className="t-subhead" style={{ margin: 0 }}>최종 판단</h3>
            <p className="t-body" style={{ margin: 0 }}>
              본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오. 예상 절감액은 참고용이며, 애매한 항목은 절감액에서 제외합니다.
            </p>
          </div>
        </section>
      </article>

      <Footer
        brand="FinSight"
        columns={[
          { head: "문서", links: [{ href: "#terms", label: "이용약관" }, { href: "#privacy", label: "개인정보처리방침" }, { href: "#tax", label: "세무 고지" }] },
          { head: "서비스", links: [{ href: "/", label: "홈으로" }] },
        ]}
      />
    </main>
  );
}
