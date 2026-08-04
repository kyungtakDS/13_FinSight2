import { ColorBlock } from "@/components/marketing/ColorBlock";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { LandingNav } from "@/components/marketing/LandingNav";
import { MarqueeStrip } from "@/components/marketing/MarqueeStrip";
import { Pricing } from "@/components/marketing/Pricing";
import { Steps } from "@/components/marketing/Steps";

const cardCompanies = ["신한카드", "삼성카드", "현대카드", "KB국민카드", "롯데카드", "우리카드", "BC카드", "하나카드"];

const canvasSection = {
  background: "var(--color-canvas)",
  padding: "var(--space-section) var(--space-lg)",
} as const;

const blockWrap = {
  margin: "0 auto",
  maxWidth: "var(--container-max)",
  padding: "0 var(--space-lg)",
} as const;

export default function Home() {
  return (
    <main style={{ background: "var(--color-canvas)", color: "var(--color-ink)" }}>
      <LandingNav />
      <MarqueeStrip items={cardCompanies} />
      <Hero />

      <div style={blockWrap}>
        <ColorBlock eyebrow="무료로 자기 숫자부터" title="결제 전에 예상 절감액을 먼저 확인합니다." variant="lime">
          업로드하면 예상 절감액과 상위 3개 인사이트를 무료로 봅니다. 자신의 실제 카드 내역으로 계산한 결과입니다.
        </ColorBlock>
      </div>

      <section aria-label="무료 리포트 설명" style={canvasSection}>
        <p className="t-subhead" style={{ margin: "0 auto", maxWidth: "var(--container-max)", textAlign: "center" }}>
          분석에는 제한을 두지 않습니다. Pro는 거래별 전체 분류 내역과 전달용 다운로드를 엽니다.
        </p>
      </section>

      <div id="data" style={blockWrap}>
        <ColorBlock eyebrow="데이터 처리" title="누가 언제 얼마를 썼는지는 서버 밖으로 나가지 않습니다." variant="navy">
          Anthropic에는 CSV 상위 20행과 가맹점 상호명만 전달합니다. 금액·날짜·카드번호·사용자 식별자는 전송하지 않고, 카드번호와 승인번호는 저장하지 않습니다.
        </ColorBlock>
      </div>

      <section aria-label="원본 보관 안내" style={canvasSection}>
        <p className="t-subhead" style={{ margin: "0 auto", maxWidth: "var(--container-max)", textAlign: "center" }}>
          원본 CSV는 비공개 저장소에 보관하고 90일 후 자동 삭제합니다. 정규화된 거래와 리포트는 이후에도 남습니다.
        </p>
      </section>

      <div style={blockWrap}>
        <ColorBlock eyebrow="보수적으로" title="애매한 항목은 절감액에서 제외합니다." variant="coral">
          업종을 특정하기 어려운 지출은 애매로 따로 표시합니다. 과대 추정을 피하고 세무사에게 확인할 항목을 숨기지 않습니다.
        </ColorBlock>
      </div>

      <Steps />
      <Pricing />

      <section aria-labelledby="tax-notice" style={{ ...canvasSection, borderTop: "var(--space-hair) solid var(--color-hairline)", textAlign: "center" }}>
        <h2 className="t-headline" id="tax-notice" style={{ margin: "0 0 var(--space-md)" }}>세무 고지</h2>
        <p className="t-body-sm" style={{ margin: "0 auto", maxWidth: "var(--container-max)" }}>
          본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오. 예상 절감액은 참고용 추정치입니다. 반복청구·해지·환불 조건은 <a href="/legal" style={{ color: "var(--color-ink)" }}>이용약관</a>에서 확인할 수 있습니다.
        </p>
      </section>

      <Footer
        brand="FinSight"
        columns={[
          { head: "제품", links: [{ href: "#how", label: "작동 방식" }, { href: "#pricing", label: "가격" }, { href: "#data", label: "데이터 처리" }] },
          { head: "약관", links: [{ href: "/legal", label: "이용약관·개인정보처리방침·세무 고지" }] },
        ]}
      />
    </main>
  );
}
