import { beforeEach, describe, expect, it, vi } from "vitest";

const clientMock = vi.hoisted(() => ({
  callStructured: vi.fn(),
}));

vi.mock("./client", async (importOriginal) => {
  const original = await importOriginal<typeof import("./client")>();
  return {
    ...original,
    callStructured: clientMock.callStructured,
  };
});

import { ClaudeCallError } from "./client";
import { mapStatusValues } from "./map-status";

const seeded = ["전표매입", "승인취소", "취소전표매입"];

describe("mapStatusValues", () => {
  beforeEach(() => {
    clientMock.callStructured.mockReset();
    clientMock.callStructured.mockResolvedValue([
      { value: "미지값", kind: "void" },
    ]);
  });

  // 세 값 모두 국민카드 309행에서 대응 매입 행 유무까지 확인했다 (ADR-014).
  it("maps the verified status values without calling Claude", async () => {
    expect(await mapStatusValues(seeded)).toEqual({
      rules: { 전표매입: "normal", 승인취소: "void", 취소전표매입: "reversal" },
      unresolved: 0,
      failureKind: null,
    });
    expect(clientMock.callStructured).not.toHaveBeenCalled();
  });

  it("sends only the values the seed dictionary does not know", async () => {
    await mapStatusValues([...seeded, "미지값"]);

    const userData = clientMock.callStructured.mock.calls[0]![0].userData as string;
    expect(JSON.parse(userData)).toEqual(["미지값"]);
  });

  it("merges the seeded values with the judged ones", async () => {
    expect((await mapStatusValues(["전표매입", "미지값"])).rules).toEqual({
      전표매입: "normal",
      미지값: "void",
    });
  });

  it("does not call Claude for an empty input", async () => {
    expect(await mapStatusValues([])).toEqual({
      rules: {},
      unresolved: 0,
      failureKind: null,
    });
    expect(clientMock.callStructured).not.toHaveBeenCalled();
  });

  it("ignores status values it never asked about", async () => {
    clientMock.callStructured.mockResolvedValue([
      { value: "미지값", kind: "void" },
      { value: "지어낸값", kind: "void" },
    ]);

    expect((await mapStatusValues(["미지값"])).rules).toEqual({ 미지값: "void" });
  });

  it("falls back to normal for values the model left out", async () => {
    clientMock.callStructured.mockResolvedValue([{ value: "미지값1", kind: "void" }]);

    expect((await mapStatusValues(["미지값1", "미지값2"])).rules).toEqual({
      미지값1: "void",
      미지값2: "normal",
    });
  });

  // 판정 실패로 업로드 전체를 죽이지 않는다. 사전에 값을 넣지 않는 것이 곧
  // 폴백이다 — normalize 가 사전에 없는 값을 normal 로 읽기 때문이다.
  it("reports a fallback instead of throwing when the call fails", async () => {
    clientMock.callStructured.mockRejectedValue(new ClaudeCallError("json_parse"));

    expect(await mapStatusValues(["미지값"])).toEqual({
      rules: {},
      unresolved: 1,
      failureKind: "json_parse",
    });
  });

  it("keeps the seeded verdicts when the call fails", async () => {
    clientMock.callStructured.mockRejectedValue(new ClaudeCallError("schema"));

    expect(await mapStatusValues(["승인취소", "미지값"])).toEqual({
      rules: { 승인취소: "void" },
      unresolved: 1,
      failureKind: "schema",
    });
  });

  // 폴백한 값이 사전에 들어가면 캐시가 굳어 다음 재시도가 다시 묻지 못한다.
  it("never puts a fallback value into the rules", async () => {
    clientMock.callStructured.mockRejectedValue(new ClaudeCallError("upstream"));

    expect((await mapStatusValues(["미지값"])).rules).not.toHaveProperty("미지값");
  });

  it("rethrows failures that are not Claude call errors", async () => {
    clientMock.callStructured.mockRejectedValue(new TypeError("x is not a function"));

    await expect(mapStatusValues(["미지값"])).rejects.toBeInstanceOf(TypeError);
  });

  it("does not log", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];

    clientMock.callStructured.mockRejectedValue(new ClaudeCallError("json_parse"));
    await mapStatusValues([...seeded, "미지값"]);

    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    vi.restoreAllMocks();
  });
});
