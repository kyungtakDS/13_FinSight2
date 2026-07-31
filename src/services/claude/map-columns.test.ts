import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import type { ColumnMap } from "@/types/csv";
import { ClaudeCallError } from "./client";
import { mapColumns } from "./map-columns";

const validResult = {
  headerRowIndex: 1,
  columnMap: { date: 0, merchant: 1, amount: 2, txnType: null },
} satisfies { headerRowIndex: number; columnMap: ColumnMap };

const rows = [
  ["카드 이용 내역"],
  ["이용일자", "가맹점명", "승인금액", "구분"],
  ["2026-01-01", "비공개 상호", "10000", "승인"],
];

describe("mapColumns", () => {
  beforeEach(() => {
    clientMock.callStructured.mockReset();
    clientMock.callStructured.mockResolvedValue(validResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends only the first 20 rows", async () => {
    const manyRows = Array.from({ length: 21 }, (_, index) => [
      `row-${index}`,
      `cell-${index}`,
      `amount-${index}`,
    ]);
    clientMock.callStructured.mockResolvedValue({
      headerRowIndex: 0,
      columnMap: { date: 0, merchant: 1, amount: 2, txnType: null },
    });

    await mapColumns(manyRows);

    const userData = clientMock.callStructured.mock.calls[0]?.[0].userData;
    expect(userData).toContain("row-19");
    expect(userData).not.toContain("row-20");
  });

  it("sends every available row when fewer than 20 exist", async () => {
    await mapColumns(rows);

    const userData = clientMock.callStructured.mock.calls[0]?.[0].userData;
    expect(userData).toContain("카드 이용 내역");
    expect(userData).toContain("비공개 상호");
  });

  it("serializes userData as a CSV string", async () => {
    await mapColumns([
      ["meta"],
      ["date", "merchant, branch", 'amount "won"'],
    ]);

    const userData = clientMock.callStructured.mock.calls[0]?.[0].userData;
    expect(typeof userData).toBe("string");
    expect(userData).toContain('date,"merchant, branch","amount ""won"""');
  });

  it("accepts only topRows in its public function signature", () => {
    const typedMapColumns: (
      topRows: string[][],
    ) => Promise<{ headerRowIndex: number; columnMap: ColumnMap }> = mapColumns;

    expect(typedMapColumns.length).toBe(1);
  });

  it("marks delimited content as data rather than instructions", async () => {
    await mapColumns(rows);

    const system = clientMock.callStructured.mock.calls[0]?.[0].system;
    expect(system).toMatch(/데이터/);
    expect(system).toMatch(/지시/);
  });

  it("rejects a negative headerRowIndex as schema", async () => {
    clientMock.callStructured.mockResolvedValue({
      ...validResult,
      headerRowIndex: -1,
    });

    await expect(mapColumns(rows)).rejects.toMatchObject({ kind: "schema" });
  });

  it("rejects a headerRowIndex beyond the supplied rows", async () => {
    clientMock.callStructured.mockResolvedValue({
      ...validResult,
      headerRowIndex: rows.length,
    });

    await expect(mapColumns(rows)).rejects.toMatchObject({ kind: "schema" });
  });

  it("rejects column indexes outside the selected header", async () => {
    clientMock.callStructured.mockResolvedValue({
      ...validResult,
      columnMap: { ...validResult.columnMap, amount: 4 },
    });

    await expect(mapColumns(rows)).rejects.toMatchObject({ kind: "schema" });
  });

  it("requires date, merchant, and amount mappings", async () => {
    clientMock.callStructured.mockImplementation(async ({ schema }) =>
      schema.parse({
        headerRowIndex: 1,
        columnMap: { date: 0, merchant: 1, txnType: null },
      }),
    );

    await expect(mapColumns(rows)).rejects.toBeDefined();
  });

  it("allows txnType to be null", async () => {
    await expect(mapColumns(rows)).resolves.toEqual(validResult);
  });

  it("rejects assigning one index to multiple roles", async () => {
    clientMock.callStructured.mockResolvedValue({
      ...validResult,
      columnMap: { ...validResult.columnMap, amount: 0 },
    });

    await expect(mapColumns(rows)).rejects.toMatchObject({ kind: "schema" });
  });

  it("uses ClaudeCallError with kind schema for mapping validation", async () => {
    clientMock.callStructured.mockResolvedValue({
      ...validResult,
      headerRowIndex: -1,
    });

    const error = await mapColumns(rows).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ClaudeCallError);
    expect(error).toMatchObject({ kind: "schema" });
  });

  it("propagates refusal errors unchanged", async () => {
    const refusal = new ClaudeCallError("refusal");
    clientMock.callStructured.mockRejectedValue(refusal);

    await expect(mapColumns(rows)).rejects.toBe(refusal);
  });

  it("propagates max_tokens errors unchanged", async () => {
    const maxTokens = new ClaudeCallError("max_tokens");
    clientMock.callStructured.mockRejectedValue(maxTokens);

    await expect(mapColumns(rows)).rejects.toBe(maxTokens);
  });

  it("never calls console methods", async () => {
    const spies = [
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "trace").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];

    await mapColumns(rows);

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("does not include cell values in validation error messages", async () => {
    const privateCell = "private-card-cell-8472";
    clientMock.callStructured.mockResolvedValue({
      headerRowIndex: 1,
      columnMap: { date: 0, merchant: 1, amount: 8, txnType: null },
    });

    const error = await mapColumns([
      ["meta"],
      ["date", privateCell, "amount"],
    ]).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ClaudeCallError);
    expect((error as Error).message).not.toContain(privateCell);
  });
});
