import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DetectCard } from "./DetectCard";

describe("DetectCard", () => {
  afterEach(cleanup);

  it("renders all preview values exclusively from props", () => {
    const { container } = render(
      <DetectCard
        filename="card.csv"
        issuerHint="신한카드"
        encoding="utf-8"
        rowCount={27}
        headerLabels={["이용일자", "가맹점명", "이용금액"]}
      />,
    );
    expect(container.querySelectorAll(".fs-detect-row")).toHaveLength(5);
    expect(screen.getByText("신한카드")).toBeInTheDocument();
    expect(screen.getByText("27행")).toHaveClass("num");
    expect(screen.getByText(/이용일자.*가맹점명.*이용금액/)).toBeInTheDocument();
    expect(screen.getByText("카드번호·승인번호는 저장하지 않습니다")).toBeInTheDocument();
  });

  it("does not invent an unknown issuer", () => {
    render(
      <DetectCard
        filename="card.csv"
        issuerHint={null}
        encoding="cp949"
        rowCount={2}
        headerLabels={null}
      />,
    );
    expect(screen.getAllByText("서버에서 판별")).toHaveLength(2);
  });
});
