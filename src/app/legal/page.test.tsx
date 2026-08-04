import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import LegalPage from "./page";

vi.mock("@/components/marketing/LandingNav", () => ({
  LandingNav: () => <nav aria-label="주요 탐색" />,
}));

describe("LegalPage", () => {
  afterEach(cleanup);

  it("renders one draft document with three anchored sections and a continuous heading hierarchy", () => {
    const { container } = render(<LegalPage />);

    expect(screen.getByRole("heading", { level: 1, name: "이용약관 및 정책" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "이용약관" })).toHaveAttribute("id", "terms");
    expect(screen.getByRole("heading", { level: 2, name: "개인정보처리방침" })).toHaveAttribute("id", "privacy");
    expect(screen.getByRole("heading", { level: 2, name: "세무 고지" })).toHaveAttribute("id", "tax");
    expect(container.querySelectorAll("h1, h2, h3")).toHaveLength(10);
    expect(container.querySelector("h4, h5, h6")).not.toBeInTheDocument();
    expect(screen.getByText(/법률 전문가 검토 전 초안/)).toBeInTheDocument();
    expect(screen.getByText(/최종 개정일: 2026년 8월 4일/)).toBeInTheDocument();
  });

  it("states the tax positioning without definitive tax instructions", () => {
    render(<LegalPage />);
    const text = document.body.textContent ?? "";

    expect(text).toContain("본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오");
    expect(text).toContain("경비 후보 정리 도구");
    expect(text).not.toMatch(/경비 처리하세요|환급받으세요|신고하세요/);
  });

  it("defines the exact external transfer, storage, deletion, and authentication scope", () => {
    render(<LegalPage />);
    const text = document.body.textContent ?? "";

    expect(text).toContain("Anthropic으로 나가는 것은 ① CSV 상위 20행 ② 가맹점 상호명뿐입니다");
    expect(text).toContain("금액·날짜·카드번호·사용자 식별자는 전송하지 않습니다");
    expect(text).toContain("누가 언제 얼마를 썼는지는 서버 밖으로 나가지 않습니다");
    expect(text).toContain("원본 CSV는 비공개 버킷에 암호화 저장하고 90일 후 자동 삭제합니다");
    expect(text).toContain("계정 삭제 시에는 즉시 전량 파기합니다");
    expect(text).toContain("카드번호·승인번호는 저장하지 않습니다");
    expect(text).toContain("90일 후 사라지는 것은 원본 파일뿐이며 거래 내역과 리포트는 남습니다");
    expect(text).toContain("이메일");
    expect(text).toContain("거래 내역(날짜·상호명·금액)");
    expect(text).toContain("계정과목");
    expect(text).toContain("판정");
    expect(text).toContain("인증은 Google 단독입니다");
    expect(text).toContain("merchant_dictionary");
    expect(text).toContain("csv_format_mappings");
    expect(text).toContain("개인정보를 담지 않는 전역 공유 자산");
  });

  it("states every billing, cancellation, retained-access, and file constraint", () => {
    render(<LegalPage />);
    const text = document.body.textContent ?? "";

    expect(text).toContain("월 반복청구 구독");
    expect(text).toContain("해지·환불은 Polar 고객 포털에서 관리합니다");
    expect(text).toContain("해지 후에도 데이터를 지우지 않습니다");
    expect(text).toContain("유료 화면인 전체 분류 내역과 다운로드는 다시 잠깁니다");
    expect(text).toContain("무료 화면은 과거 분석 전부에 계속 열립니다");
    expect(text).toContain("이미 다운로드한 파일은 회수하지 않습니다");
    expect(text).toContain("재구독하면 즉시 전부 다시 열립니다");
    expect(text).toContain("CSV only");
    expect(text).toContain("2MB");
    expect(text).toContain("3,000행");
  });

  it("keeps the legal page undecorated and within marketing token rules", () => {
    const source = readFileSync(join(process.cwd(), "src/app/legal/page.tsx"), "utf8");

    expect(source).not.toMatch(/ColorBlock|MarqueeStrip/);
    expect(source).not.toContain("--fs-");
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\b\d+(?:\.\d+)?px\b/);
    expect(source).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(source).not.toMatch(/어떤 정보도.*나가지 않|일절 전송하지 않/);
  });
});
