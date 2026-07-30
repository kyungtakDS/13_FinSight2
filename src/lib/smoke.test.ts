import { describe, expect, it } from "vitest";

describe("toolchain smoke test", () => {
  it("runs arithmetic assertions", () => {
    expect(1 + 1).toBe(2);
  });

  it("executes TypeScript annotations", () => {
    const projectName: string = "FinSight2";

    expect(projectName).toBe("FinSight2");
  });

  it("uses the jsdom environment", () => {
    expect(typeof document).not.toBe("undefined");
  });

  it("keeps Node globals available", () => {
    expect(typeof TextDecoder).toBe("function");
  });
});
