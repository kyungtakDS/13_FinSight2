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

import { ACCOUNT_CODES } from "@/types/account-codes";
import { ClaudeCallError } from "./client";
import {
  CLASSIFY_BATCH_SIZE,
  classifyMerchants,
  type MerchantVerdict,
} from "./classify-merchants";

function result(
  index: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    index,
    accountCode: "supplies",
    verdict: "expense",
    reason: "업무용 소모품 판매점",
    ...overrides,
  };
}

describe("classifyMerchants", () => {
  beforeEach(() => {
    clientMock.callStructured.mockReset();
    clientMock.callStructured.mockImplementation(
      async ({ userData }: { userData: string }) => {
        const names = JSON.parse(userData) as string[];
        return names.map((_, index) => result(index));
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts only a merchant-name array in its public signature", () => {
    const typed: (names: string[]) => Promise<MerchantVerdict[]> =
      classifyMerchants;
    expect(typed.length).toBe(1);
  });

  it("sends userData containing only merchant-name strings", async () => {
    await classifyMerchants(["상호 A", "상호 B"]);

    const userData = clientMock.callStructured.mock.calls[0]?.[0].userData;
    expect(JSON.parse(userData)).toEqual(["상호 A", "상호 B"]);
    expect(userData).not.toMatch(/amount|txnDate|rowIndex|userId/u);
  });

  it("returns an empty array without calling Claude", async () => {
    await expect(classifyMerchants([])).resolves.toEqual([]);
    expect(clientMock.callStructured).not.toHaveBeenCalled();
  });

  it("asks about duplicate merchants once and restores input order", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { accountCode: "fees" }),
      result(1, { accountCode: "travel" }),
    ]);

    const verdicts = await classifyMerchants(["상호 A", "상호 B", "상호 A"]);

    expect(
      JSON.parse(clientMock.callStructured.mock.calls[0]?.[0].userData),
    ).toEqual(["상호 A", "상호 B"]);
    expect(verdicts.map(({ accountCode }) => accountCode)).toEqual([
      "fees",
      "travel",
      "fees",
    ]);
  });

  it("puts all 18 account codes and labels in the system prompt", async () => {
    await classifyMerchants(["상호"]);
    const system = clientMock.callStructured.mock.calls[0]?.[0].system;

    for (const account of ACCOUNT_CODES) {
      expect(system).toContain(`${account.code} (${account.label})`);
    }
  });

  it("marks delimited merchant content as data rather than instructions", async () => {
    await classifyMerchants(["상호"]);
    const system = clientMock.callStructured.mock.calls[0]?.[0].system;

    expect(system).toMatch(/구분자/u);
    expect(system).toMatch(/데이터/u);
    expect(system).toMatch(/지시/u);
  });

  it("rejects a response with a different length as schema", async () => {
    clientMock.callStructured.mockResolvedValue([result(0)]);

    await expect(classifyMerchants(["A", "B"])).rejects.toMatchObject({
      kind: "schema",
    });
  });

  it("rejects a non-array response as schema", async () => {
    clientMock.callStructured.mockResolvedValue({ items: [result(0)] });

    await expect(classifyMerchants(["A"])).rejects.toMatchObject({
      kind: "schema",
    });
  });

  it("rejects out-of-order indexes instead of sorting them", async () => {
    clientMock.callStructured.mockResolvedValue([result(1), result(0)]);

    await expect(classifyMerchants(["A", "B"])).rejects.toMatchObject({
      kind: "schema",
    });
  });

  it("rejects a matching-length response with a missing index", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0),
      { accountCode: "travel", verdict: "expense", reason: null },
    ]);

    await expect(classifyMerchants(["A", "B"])).rejects.toMatchObject({
      kind: "schema",
    });
  });

  // 진단용 분류. "schema" 하나로는 프롬프트를 고쳐야 하는지, 배치 크기를
  // 줄여야 하는지, 응답 형태를 바꿔야 하는지 알 수 없다.
  it("labels a length mismatch with the expected and actual counts", async () => {
    clientMock.callStructured.mockResolvedValue([result(0)]);

    await expect(classifyMerchants(["A", "B", "C"])).rejects.toMatchObject({
      kind: "schema",
      failureKind: "length_mismatch",
      batchNumber: 1,
      expectedCount: 3,
      actualCount: 1,
    });
  });

  it("labels a non-array response as a length mismatch with a null count", async () => {
    clientMock.callStructured.mockResolvedValue({ items: [result(0)] });

    await expect(classifyMerchants(["A"])).rejects.toMatchObject({
      failureKind: "length_mismatch",
      expectedCount: 1,
      actualCount: null,
    });
  });

  it("labels out-of-order indexes as an index mismatch", async () => {
    clientMock.callStructured.mockResolvedValue([result(1), result(0)]);

    await expect(classifyMerchants(["A", "B"])).rejects.toMatchObject({
      failureKind: "index_mismatch",
      expectedCount: 2,
      actualCount: 2,
    });
  });

  it("labels unparsable JSON reported by the client", async () => {
    clientMock.callStructured.mockRejectedValue(
      new ClaudeCallError("json_parse"),
    );

    await expect(classifyMerchants(["A", "B"])).rejects.toMatchObject({
      failureKind: "json_parse_failed",
      expectedCount: 2,
      actualCount: null,
    });
  });

  it("labels a schema violation reported by the client", async () => {
    clientMock.callStructured.mockRejectedValue(new ClaudeCallError("schema"));

    await expect(classifyMerchants(["A", "B"])).rejects.toMatchObject({
      failureKind: "schema_validation_failed",
      expectedCount: 2,
      actualCount: null,
    });
  });

  it("passes non-schema Claude failures through untouched", async () => {
    const refusal = new ClaudeCallError("refusal");
    clientMock.callStructured.mockRejectedValue(refusal);

    await expect(classifyMerchants(["A"])).rejects.toBe(refusal);
  });

  it("reports which batch failed, not always the first", async () => {
    const names = Array.from(
      { length: CLASSIFY_BATCH_SIZE + 2 },
      (_, index) => `M${index}`,
    );
    clientMock.callStructured.mockImplementation(
      async ({ userData }: { userData: string }) => {
        const batch = JSON.parse(userData) as string[];
        if (batch.length === CLASSIFY_BATCH_SIZE) {
          return batch.map((_, index) => result(index));
        }
        return [];
      },
    );

    await expect(classifyMerchants(names)).rejects.toMatchObject({
      failureKind: "length_mismatch",
      batchNumber: 2,
      expectedCount: 2,
      actualCount: 0,
    });
  });

  it("keeps merchant names out of the diagnostic error", async () => {
    clientMock.callStructured.mockResolvedValue([]);
    const canary = "가맹점명_CANARY_UNIQUE";

    const error = await classifyMerchants([canary]).catch(
      (caught: unknown) => caught,
    );

    expect(JSON.stringify(error)).not.toContain(canary);
    expect((error as Error).message).not.toContain(canary);
  });

  it("downgrades an unknown account code to uncertain", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { accountCode: "invented" }),
      result(1, { accountCode: "travel" }),
    ]);

    await expect(classifyMerchants(["A", "B"])).resolves.toEqual([
      { accountCode: null, verdict: "uncertain", reason: null },
      {
        accountCode: "travel",
        verdict: "expense",
        reason: "업무용 소모품 판매점",
      },
    ]);
  });

  it("downgrades an unknown verdict to uncertain", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { verdict: "probably" }),
    ]);

    await expect(classifyMerchants(["A"])).resolves.toEqual([
      { accountCode: null, verdict: "uncertain", reason: null },
    ]);
  });

  it("forces accountCode to null for uncertain verdicts", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, {
        accountCode: "travel",
        verdict: "uncertain",
        reason: "업종을 특정할 수 없음",
      }),
    ]);

    await expect(classifyMerchants(["A"])).resolves.toEqual([
      {
        accountCode: null,
        verdict: "uncertain",
        reason: "업종을 특정할 수 없음",
      },
    ]);
  });

  it("keeps a model uncertain verdict without guessing", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { accountCode: null, verdict: "uncertain", reason: null }),
    ]);

    await expect(classifyMerchants(["A"])).resolves.toEqual([
      { accountCode: null, verdict: "uncertain", reason: null },
    ]);
  });

  it("uses null for a missing or multiline reason", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { reason: undefined }),
      result(1, { reason: "첫 줄\n둘째 줄" }),
    ]);

    await expect(classifyMerchants(["A", "B"])).resolves.toEqual([
      { accountCode: "supplies", verdict: "expense", reason: null },
      { accountCode: "supplies", verdict: "expense", reason: null },
    ]);
  });

  it("truncates an overly long reason", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { reason: "가".repeat(501) }),
    ]);

    const [verdict] = await classifyMerchants(["A"]);
    expect(verdict.reason).toHaveLength(500);
  });

  it("calls Claude in batches of 100 and preserves overall order", async () => {
    const names = Array.from(
      { length: CLASSIFY_BATCH_SIZE + 2 },
      (_, index) => `상호-${index}`,
    );
    clientMock.callStructured
      .mockResolvedValueOnce(
        Array.from({ length: CLASSIFY_BATCH_SIZE }, (_, index) =>
          result(index, { reason: `첫 배치-${index}` }),
        ),
      )
      .mockResolvedValueOnce([
        result(0, { reason: "둘째 배치-0" }),
        result(1, { reason: "둘째 배치-1" }),
      ]);

    const verdicts = await classifyMerchants(names);

    expect(clientMock.callStructured).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(clientMock.callStructured.mock.calls[0]?.[0].userData),
    ).toHaveLength(CLASSIFY_BATCH_SIZE);
    expect(verdicts.map(({ reason }) => reason)).toEqual([
      ...Array.from(
        { length: CLASSIFY_BATCH_SIZE },
        (_, index) => `첫 배치-${index}`,
      ),
      "둘째 배치-0",
      "둘째 배치-1",
    ]);
  });

  it("fails the whole operation when a later batch fails", async () => {
    const failure = new ClaudeCallError("upstream");
    clientMock.callStructured
      .mockResolvedValueOnce(
        Array.from({ length: CLASSIFY_BATCH_SIZE }, (_, index) =>
          result(index),
        ),
      )
      .mockRejectedValueOnce(failure);

    await expect(
      classifyMerchants(
        Array.from(
          { length: CLASSIFY_BATCH_SIZE + 1 },
          (_, index) => `상호-${index}`,
        ),
      ),
    ).rejects.toBe(failure);
  });

  it.each(["refusal", "max_tokens"] as const)(
    "propagates %s errors unchanged",
    async (kind) => {
      const failure = new ClaudeCallError(kind);
      clientMock.callStructured.mockRejectedValue(failure);

      await expect(classifyMerchants(["A"])).rejects.toBe(failure);
    },
  );

  it("never calls console methods", async () => {
    const spies = [
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "trace").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
    ];

    await classifyMerchants(["비공개 상호"]);

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("does not include merchant names in validation error messages", async () => {
    const privateMerchant = "private-merchant-8472";
    clientMock.callStructured.mockResolvedValue([]);

    const error = await classifyMerchants([privateMerchant]).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ClaudeCallError);
    expect((error as Error).message).not.toContain(privateMerchant);
  });
});
