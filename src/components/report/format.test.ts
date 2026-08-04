import { describe, expect, it } from "vitest";

import { formatWon } from "./format";

describe("formatWon", () => {
  it("formats positive and negative won amounts with Korean separators", () => {
    expect(formatWon(1234567)).toEqual({ sign: "", currency: "₩", digits: "1,234,567" });
    expect(formatWon(-8900)).toEqual({ sign: "-", currency: "₩", digits: "8,900" });
  });
});
