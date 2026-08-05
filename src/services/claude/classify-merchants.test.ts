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

  // personal 은 계정과목을 갖지 않는다 — 18개 코드가 전부 사업용 경비 계정이라
  // 개인 지출에 붙일 코드가 없다. accountCode: null 은 오류가 아니라 정상값이다.
  it("keeps a personal verdict that carries a null account code", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, {
        accountCode: null,
        verdict: "personal",
        reason: "개인 미용 서비스",
      }),
    ]);

    await expect(classifyMerchants(["A"])).resolves.toEqual([
      { accountCode: null, verdict: "personal", reason: "개인 미용 서비스" },
    ]);
  });

  it("forces accountCode to null for personal verdicts", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, {
        accountCode: "welfare",
        verdict: "personal",
        reason: "개인 지출",
      }),
    ]);

    await expect(classifyMerchants(["A"])).resolves.toEqual([
      { accountCode: null, verdict: "personal", reason: "개인 지출" },
    ]);
  });

  it("requires a valid account code for expense but not for personal", async () => {
    clientMock.callStructured.mockResolvedValue([
      result(0, { accountCode: null, verdict: "expense" }),
      result(1, { accountCode: null, verdict: "personal", reason: "개인 의류" }),
    ]);

    await expect(classifyMerchants(["A", "B"])).resolves.toEqual([
      { accountCode: null, verdict: "uncertain", reason: null },
      { accountCode: null, verdict: "personal", reason: "개인 의류" },
    ]);
  });

  it("tells the model that a personal verdict uses a null account code", async () => {
    await classifyMerchants(["상호"]);
    const system = clientMock.callStructured.mock.calls[0]?.[0].system;

    expect(system).toMatch(/personal이면 accountCode는 null/u);
  });

  it("lists concrete personal spending examples in the system prompt", async () => {
    await classifyMerchants(["상호"]);
    const system = clientMock.callStructured.mock.calls[0]?.[0].system;

    for (const example of [
      "개인 식료품",
      "의류",
      "미용",
      "개인 의료",
      "취미",
      "여가",
      "개인 구독",
    ]) {
      expect(system).toContain(example);
    }
  });

  it("tells the model to prefer personal over uncertain when spending is clearly personal", async () => {
    await classifyMerchants(["상호"]);
    const system = clientMock.callStructured.mock.calls[0]?.[0].system;

    expect(system).toMatch(/명백한 개인 지출[^\n]*uncertain[^\n]*personal/u);
  });

  it("shows an exact JSON output example covering all three verdicts", async () => {
    await classifyMerchants(["상호"]);
    const system: string = clientMock.callStructured.mock.calls[0]?.[0].system;
    const [example] = /\[\{.*\}\]/u.exec(system) ?? [];

    expect(example).toBeDefined();
    const parsed = JSON.parse(example!) as Record<string, unknown>[];
    expect(parsed.map((item) => item.verdict)).toEqual([
      "expense",
      "personal",
      "uncertain",
    ]);
    expect(parsed[1]).toMatchObject({ verdict: "personal", accountCode: null });
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

/** 국민카드 재현용 — 고유 가맹점 131개는 배치를 여러 개로 쪼개는 첫 사례다. */
function syntheticMerchants(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `가맹점 ${index + 1}호점`);
}

describe("classifyMerchants batching", () => {
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

  // 100건 배치는 요청 하나가 지나치게 커진다. 작게 쪼개면 실패해도 잃는 범위가 좁고
  // 재시도 비용도 낮다.
  it("keeps the batch size small enough to survive one upstream rejection", () => {
    expect(CLASSIFY_BATCH_SIZE).toBeGreaterThanOrEqual(30);
    expect(CLASSIFY_BATCH_SIZE).toBeLessThanOrEqual(50);
  });

  it("splits 131 unique merchants into whole batches no larger than the limit", async () => {
    const names = syntheticMerchants(131);

    const verdicts = await classifyMerchants(names);

    const sizes = clientMock.callStructured.mock.calls.map(
      ([{ userData }]: [{ userData: string }]) =>
        (JSON.parse(userData) as string[]).length,
    );
    expect(sizes).toHaveLength(Math.ceil(131 / CLASSIFY_BATCH_SIZE));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(CLASSIFY_BATCH_SIZE);
    expect(sizes.reduce((total, size) => total + size, 0)).toBe(131);
    expect(verdicts).toHaveLength(131);
  });

  it("scales the token budget to the batch instead of asking for a fixed 12k", async () => {
    await classifyMerchants(syntheticMerchants(131));

    const budgets = clientMock.callStructured.mock.calls.map(
      ([{ maxTokens }]: [{ maxTokens: number }]) => maxTokens,
    );
    expect(Math.max(...budgets)).toBeLessThan(12_000);
    expect(Math.min(...budgets)).toBeGreaterThan(0);
  });

  it("reports each finished batch as it completes", async () => {
    const seen: number[] = [];

    await classifyMerchants(syntheticMerchants(131), {
      onBatchComplete: ({ names, verdicts }) => {
        expect(names).toHaveLength(verdicts.length);
        seen.push(names.length);
      },
    });

    expect(seen).toHaveLength(Math.ceil(131 / CLASSIFY_BATCH_SIZE));
    expect(seen.reduce((total, size) => total + size, 0)).toBe(131);
  });

  // 마지막 배치가 죽었다고 앞 배치의 LLM 비용까지 버리면, 재시도는 매번 처음부터
  // 다시 분류하고 같은 지점에서 다시 죽는다.
  it("hands back the batches that succeeded before a later batch fails", async () => {
    const names = syntheticMerchants(131);
    let call = 0;
    clientMock.callStructured.mockImplementation(
      async ({ userData }: { userData: string }) => {
        call += 1;
        if (call === 3) {
          throw new ClaudeCallError("upstream");
        }
        const batch = JSON.parse(userData) as string[];
        return batch.map((_, index) => result(index));
      },
    );
    const completed: string[] = [];

    const error = await classifyMerchants(names, {
      onBatchComplete: ({ names: batchNames }) => {
        completed.push(...batchNames);
      },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ClaudeCallError);
    expect(completed).toHaveLength(CLASSIFY_BATCH_SIZE * 2);
    expect(completed).toEqual(names.slice(0, CLASSIFY_BATCH_SIZE * 2));
  });

  it("propagates a failure raised by the batch callback", async () => {
    const failure = new Error("dictionary write failed");

    const error = await classifyMerchants(syntheticMerchants(60), {
      onBatchComplete: () => {
        throw failure;
      },
    }).catch((caught: unknown) => caught);

    expect(error).toBe(failure);
  });
});
