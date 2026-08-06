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

import { mapStatusValues } from "./map-status";

const values = ["전표매입", "승인취소", "취소전표매입"];

describe("mapStatusValues", () => {
  beforeEach(() => {
    clientMock.callStructured.mockReset();
    clientMock.callStructured.mockResolvedValue([
      { value: "전표매입", kind: "normal" },
      { value: "승인취소", kind: "void" },
      { value: "취소전표매입", kind: "reversal" },
    ]);
  });

  it("maps each status value to its meaning", async () => {
    expect(await mapStatusValues(values)).toEqual({
      전표매입: "normal",
      승인취소: "void",
      취소전표매입: "reversal",
    });
  });

  it("sends only the status values", async () => {
    await mapStatusValues(values);

    const userData = clientMock.callStructured.mock.calls[0]![0].userData as string;
    expect(JSON.parse(userData)).toEqual(values);
  });

  it("does not call Claude for an empty input", async () => {
    expect(await mapStatusValues([])).toEqual({});
    expect(clientMock.callStructured).not.toHaveBeenCalled();
  });

  it("ignores status values it never asked about", async () => {
    clientMock.callStructured.mockResolvedValue([
      { value: "전표매입", kind: "normal" },
      { value: "지어낸값", kind: "void" },
    ]);

    expect(await mapStatusValues(["전표매입"])).toEqual({ 전표매입: "normal" });
  });

  it("falls back to normal for values the model left out", async () => {
    clientMock.callStructured.mockResolvedValue([{ value: "승인취소", kind: "void" }]);

    expect(await mapStatusValues(values)).toEqual({
      전표매입: "normal",
      승인취소: "void",
      취소전표매입: "normal",
    });
  });

  it("does not log", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];

    await mapStatusValues(values);

    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    vi.restoreAllMocks();
  });
});
