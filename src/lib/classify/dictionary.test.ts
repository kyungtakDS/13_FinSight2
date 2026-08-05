import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServiceClientMock } = vi.hoisted(() => ({
  createServiceClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: createServiceClientMock,
}));

import {
  encodedFilterBytes,
  lookupMerchants,
  LOOKUP_FILTER_BUDGET_BYTES,
  merchantKey,
  upsertMerchants,
} from "./dictionary";

type DictionaryRow = {
  merchant_key: string;
  account_code: string;
  default_verdict: string;
  reason: string | null;
};

function mockClient(options?: {
  rowsByBatch?: DictionaryRow[][];
  lookupError?: unknown;
  upsertError?: unknown;
}) {
  const inMock = vi.fn();
  for (const rows of options?.rowsByBatch ?? []) {
    inMock.mockResolvedValueOnce({
      data: rows,
      error: options?.lookupError ?? null,
    });
  }
  const selectMock = vi.fn(() => ({ in: inMock }));
  const upsertMock = vi.fn().mockResolvedValue({
    error: options?.upsertError ?? null,
  });
  const fromMock = vi.fn(() => ({
    select: selectMock,
    upsert: upsertMock,
  }));
  createServiceClientMock.mockReturnValue({ from: fromMock });
  return { fromMock, selectMock, inMock, upsertMock };
}

describe("merchantKey", () => {
  it("trims surrounding whitespace and collapses internal whitespace", () => {
    expect(merchantKey("  스타\t  카페 \n 강남점  ")).toBe(
      "스타 카페 강남점",
    );
  });

  it("normalizes canonically equivalent Unicode to NFC", () => {
    expect(merchantKey("\u1100\u1161")).toBe(merchantKey("가"));
    expect(merchantKey("\u1100\u1161")).toBe("가");
  });

  it("normalizes Latin letter casing without changing Hangul", () => {
    expect(merchantKey("StarBUCKS 강남")).toBe("starbucks 강남");
  });

  it("is deterministic", () => {
    const values = Array.from({ length: 10 }, () =>
      merchantKey("  Café   가게 "),
    );
    expect(new Set(values)).toEqual(new Set(["café 가게"]));
  });

  it("is shared symmetrically by lookup and upsert", async () => {
    const decomposed = "  Cafe\u0301   강남 ";
    const normalized = merchantKey(decomposed);
    const db = mockClient({
      rowsByBatch: [
        [
          {
            merchant_key: normalized,
            account_code: "comms",
            default_verdict: "expense",
            reason: null,
          },
        ],
      ],
    });

    await lookupMerchants([decomposed]);
    await upsertMerchants([
      {
        merchantKey: decomposed,
        accountCode: "comms",
        defaultVerdict: "expense",
        reason: null,
      },
    ]);

    expect(db.inMock).toHaveBeenCalledWith("merchant_key", [normalized]);
    expect(db.upsertMock).toHaveBeenCalledWith(
      [expect.objectContaining({ merchant_key: normalized })],
      expect.anything(),
    );
  });
});

describe("lookupMerchants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty Map without touching the database for empty input", async () => {
    const result = await lookupMerchants([]);
    expect(result).toEqual(new Map());
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("queries duplicate normalized keys only once", async () => {
    const db = mockClient({ rowsByBatch: [[]] });
    await lookupMerchants(["ACME", " acme ", "Acme"]);
    expect(db.inMock).toHaveBeenCalledOnce();
    expect(db.inMock).toHaveBeenCalledWith("merchant_key", ["acme"]);
  });

  it("omits missing keys instead of adding null values", async () => {
    mockClient({
      rowsByBatch: [
        [
          {
            merchant_key: "found",
            account_code: "fees",
            default_verdict: "expense",
            reason: "한 줄",
          },
        ],
      ],
    });
    const result = await lookupMerchants(["found", "missing"]);
    expect(result.has("found")).toBe(true);
    expect(result.has("missing")).toBe(false);
  });

  it("maps database rows to DictEntry values", async () => {
    mockClient({
      rowsByBatch: [
        [
          {
            merchant_key: "shop",
            account_code: "supplies",
            default_verdict: "personal",
            reason: null,
          },
        ],
      ],
    });
    await expect(lookupMerchants(["shop"])).resolves.toEqual(
      new Map([
        [
          "shop",
          {
            merchantKey: "shop",
            accountCode: "supplies",
            defaultVerdict: "personal",
            reason: null,
          },
        ],
      ]),
    );
  });

  it("uses the global table without any user filter", async () => {
    const db = mockClient({ rowsByBatch: [[]] });
    await lookupMerchants(["shop"]);
    expect(db.fromMock).toHaveBeenCalledWith("merchant_dictionary");
    expect(db.selectMock).toHaveBeenCalledWith(
      "merchant_key, account_code, default_verdict, reason",
    );
    expect(JSON.stringify(db.inMock.mock.calls)).not.toMatch(
      /user_id|userId/,
    );
  });

  // 예전에는 500 개씩 잘랐다. 개수는 URL 길이를 말해 주지 않아서, 한글 키에서는
  // 131 개만으로도 필터가 8,880 바이트가 되어 요청이 거절됐다.
  it("splits 1,500 unique keys into budgeted batches", async () => {
    const db = mockClient();
    db.inMock.mockResolvedValue({ data: [], error: null });
    const keys = Array.from({ length: 1_500 }, (_, index) => `merchant-${index}`);

    await lookupMerchants(keys);

    const batches = db.inMock.mock.calls.map((call) => call[1] as string[]);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(encodedFilterBytes(batch)).toBeLessThanOrEqual(LOOKUP_FILTER_BUDGET_BYTES);
    }
    expect(batches.flat()).toHaveLength(1_500);
  });

  it("propagates database lookup errors", async () => {
    const failure = new Error("lookup failed");
    const db = mockClient();
    db.inMock.mockResolvedValueOnce({ data: null, error: failure });
    await expect(lookupMerchants(["shop"])).rejects.toBe(failure);
  });
});

describe("upsertMerchants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects account codes outside the fixed list per item", async () => {
    const db = mockClient();
    const result = await upsertMerchants([
      {
        merchantKey: "valid",
        accountCode: "fees",
        defaultVerdict: "expense",
        reason: null,
      },
      {
        merchantKey: "invalid",
        accountCode: "invented",
        defaultVerdict: "expense",
        reason: null,
      },
    ]);
    expect(result).toEqual({ inserted: 1, rejected: 1 });
    expect(db.upsertMock.mock.calls[0][0]).toHaveLength(1);
  });

  it.each(["uncertain", "other", null])(
    "rejects unsupported default verdict %s",
    async (defaultVerdict) => {
      const db = mockClient();
      await expect(
        upsertMerchants([
          {
            merchantKey: "shop",
            accountCode: "fees",
            defaultVerdict,
            reason: null,
          },
        ]),
      ).resolves.toEqual({ inserted: 0, rejected: 1 });
      expect(db.upsertMock).not.toHaveBeenCalled();
    },
  );

  it.each(["", "   ", "\t\n"])("rejects empty merchant key %j", async (key) => {
    const db = mockClient();
    const result = await upsertMerchants([
      {
        merchantKey: key,
        accountCode: "fees",
        defaultVerdict: "expense",
        reason: null,
      },
    ]);
    expect(result).toEqual({ inserted: 0, rejected: 1 });
    expect(db.upsertMock).not.toHaveBeenCalled();
  });

  it("rejects a reason that is not a single reasonably sized line", async () => {
    const db = mockClient();
    const result = await upsertMerchants([
      {
        merchantKey: "long",
        accountCode: "fees",
        defaultVerdict: "expense",
        reason: "x".repeat(501),
      },
      {
        merchantKey: "multiline",
        accountCode: "fees",
        defaultVerdict: "expense",
        reason: "first\nsecond",
      },
    ]);
    expect(result).toEqual({ inserted: 0, rejected: 2 });
    expect(db.upsertMock).not.toHaveBeenCalled();
  });

  it("returns the exact rejected count for malformed unknown values", async () => {
    mockClient();
    await expect(
      upsertMerchants([
        null,
        "merchant",
        {},
        {
          merchantKey: "ok",
          accountCode: "ads",
          defaultVerdict: "personal",
          reason: "한 줄",
        },
      ]),
    ).resolves.toEqual({ inserted: 1, rejected: 3 });
  });

  it("never includes a user identifier in inserted rows", async () => {
    const db = mockClient();
    await upsertMerchants([
      {
        merchantKey: "shop",
        accountCode: "rent",
        defaultVerdict: "expense",
        reason: null,
        userId: "must-not-leak",
        user_id: "must-not-leak",
      },
    ]);
    const payload = db.upsertMock.mock.calls[0][0];
    expect(payload).toEqual([
      {
        merchant_key: "shop",
        account_code: "rent",
        default_verdict: "expense",
        reason: null,
        updated_at: expect.any(String),
      },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/user_id|userId/);
  });

  it("does not touch the database for empty input", async () => {
    await expect(upsertMerchants([])).resolves.toEqual({
      inserted: 0,
      rejected: 0,
    });
    expect(createServiceClientMock).not.toHaveBeenCalled();
  });

  it("upserts by the merchant primary key and refreshes updated_at", async () => {
    const db = mockClient();
    await upsertMerchants([
      {
        merchantKey: "SHOP",
        accountCode: "utilities",
        defaultVerdict: "expense",
        reason: "한 줄",
      },
    ]);
    expect(db.upsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          merchant_key: "shop",
          updated_at: expect.stringMatching(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
          ),
        }),
      ],
      { onConflict: "merchant_key" },
    );
  });

  it("propagates database upsert errors", async () => {
    const failure = new Error("upsert failed");
    const db = mockClient({ upsertError: failure });
    await expect(
      upsertMerchants([
        {
          merchantKey: "shop",
          accountCode: "fees",
          defaultVerdict: "expense",
          reason: null,
        },
      ]),
    ).rejects.toBe(failure);
    expect(db.upsertMock).toHaveBeenCalledOnce();
  });

  it("does not call console methods while handling merchant data", async () => {
    const spies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
    ];
    mockClient();
    await upsertMerchants([
      {
        merchantKey: "private merchant",
        accountCode: "etc",
        defaultVerdict: "personal",
        reason: null,
      },
    ]);
    expect(spies.every((spy) => spy.mock.calls.length === 0)).toBe(true);
    spies.forEach((spy) => spy.mockRestore());
  });
});

/**
 * PostgREST 는 .in() 필터를 URL 쿼리스트링에 싣는다. 한글은 인코딩 시 문자당
 * 9 바이트라, 개수로만 배치하면 게이트웨이 URI 한도를 넘겨 요청 자체가 거절된다.
 * 실제로 국민카드(고유 가맹점 131 개, 인코딩 8,880 바이트)가 여기서 죽었다.
 */
describe("lookupMerchants request budget", () => {
  function alwaysEmptyClient() {
    const inMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const selectMock = vi.fn(() => ({ in: inMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    createServiceClientMock.mockReturnValue({ from: fromMock });
    return inMock;
  }

  function batchesFrom(inMock: ReturnType<typeof vi.fn>): string[][] {
    return inMock.mock.calls.map((call) => call[1] as string[]);
  }

  const koreanKeys = Array.from(
    { length: 131 },
    (_, index) => `가맹점 ${index + 1}호점 서울강남지점`,
  );

  it("keeps every request's encoded filter within the budget", async () => {
    const inMock = alwaysEmptyClient();

    await lookupMerchants(koreanKeys);

    const batches = batchesFrom(inMock);
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) {
      expect(encodedFilterBytes(batch)).toBeLessThanOrEqual(LOOKUP_FILTER_BUDGET_BYTES);
    }
  });

  it("covers every key exactly once across the requests", async () => {
    const inMock = alwaysEmptyClient();

    await lookupMerchants(koreanKeys);

    const seen = batchesFrom(inMock).flat();
    expect([...seen].sort()).toEqual([...new Set(koreanKeys.map(merchantKey))].sort());
  });

  it("still sends a single request when the keys are few", async () => {
    const inMock = alwaysEmptyClient();

    await lookupMerchants(["카페 하나", "서점 둘"]);

    expect(batchesFrom(inMock)).toHaveLength(1);
  });

  it("never emits an empty request", async () => {
    const inMock = alwaysEmptyClient();

    await lookupMerchants(koreanKeys);

    for (const batch of batchesFrom(inMock)) {
      expect(batch.length).toBeGreaterThan(0);
    }
  });

  // 한 키가 예산보다 길어도 요청은 나가야 한다 — 못 보내면 그 가맹점은 영원히 미분류다.
  it("still sends a single oversized key on its own", async () => {
    const inMock = alwaysEmptyClient();
    const huge = "가".repeat(LOOKUP_FILTER_BUDGET_BYTES);

    await lookupMerchants([huge, "카페 하나"]);

    const batches = batchesFrom(inMock);
    expect(batches.flat()).toContain(merchantKey(huge));
    expect(batches.some((batch) => batch.length === 1)).toBe(true);
  });
});
