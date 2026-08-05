import {
  lookupMerchants,
  merchantKey,
  upsertMerchants,
  type DictEntry,
} from "@/lib/classify/dictionary";
import { FINGERPRINT_ROWS, headerFingerprint } from "@/lib/csv/fingerprint";
import {
  decodeCsv,
  detectEncoding,
  normalizeRows,
  parseRows,
  RowLimitExceeded,
  type CsvEncoding,
} from "@/lib/csv/normalize";
import { aggregate, txnPeriod } from "@/lib/report/aggregate";
import {
  createServiceClient,
  deleteTransactionsForUser,
  downloadOriginalForUser,
  getUploadForUser,
  insertTransactionsForUser,
  updateUploadForUser,
} from "@/lib/supabase/service";
import {
  ClassifyBatchError,
  classifyMerchants,
} from "@/services/claude/classify-merchants";
import { ClaudeCallError, type ClaudeCallErrorKind } from "@/services/claude/client";
import { mapColumns } from "@/services/claude/map-columns";
import type { ColumnMap } from "@/types/csv";
import type { ErrorCode } from "@/types/errors";
import type { ClassifiedTxn, NormalizedTxn, Verdict } from "@/types/transaction";

type Stage =
  | "load"
  | "parse"
  | "mapping-cache"
  | "mapping"
  | "classify"
  | "persist";

type CachedMapping = {
  header_row_index: number;
  column_map: ColumnMap;
  encoding: CsvEncoding | null;
};

function errorCode(error: unknown, stage: Stage, expired: boolean): ErrorCode {
  if (expired && stage === "load") return "expired";
  if (error instanceof RowLimitExceeded) return "too_large";
  if (stage === "load" || stage === "parse" || stage === "mapping") {
    return "parse_failed";
  }
  if (error instanceof ClaudeCallError && error.kind !== "upstream") {
    return "analysis_failed";
  }
  return "upstream";
}

function llmKind(error: unknown): ClaudeCallErrorKind | undefined {
  return error instanceof ClaudeCallError ? error.kind : undefined;
}

/**
 * 배치 검증 실패의 진단 정보. 개수와 위치만 담고 상호명·거래내역은 담지 않는다
 * — 이 값들만으로 "몇 번째 배치에서 몇 개를 기대했는데 몇 개가 왔는지"가
 * 드러나야 재현을 기다리지 않고 원인을 좁힐 수 있다.
 */
function classifyDiagnosis(error: unknown): Record<string, unknown> {
  if (!(error instanceof ClassifyBatchError)) {
    return {};
  }
  return {
    stage: "classify",
    batchNumber: error.batchNumber,
    expectedCount: error.expectedCount,
    actualCount: error.actualCount,
    failureKind: error.failureKind,
  };
}

async function readMapping(fingerprint: string): Promise<CachedMapping | null> {
  const { data, error } = await createServiceClient()
    .from("csv_format_mappings")
    .select("header_row_index, column_map, encoding")
    .eq("header_fingerprint", fingerprint)
    .maybeSingle();
  if (error) throw error;
  return data as CachedMapping | null;
}

async function saveMapping(
  fingerprint: string,
  headerRowIndex: number,
  columnMap: ColumnMap,
  encoding: CsvEncoding,
): Promise<void> {
  const { error } = await createServiceClient()
    .from("csv_format_mappings")
    .upsert(
      {
        header_fingerprint: fingerprint,
        column_map: columnMap,
        header_row_index: headerRowIndex,
        encoding,
      },
      { onConflict: "header_fingerprint" },
    );
  if (error) throw error;
}

/**
 * personalKeys 는 이번 분석에서만 유효한 personal 판정이다. merchant_dictionary 는
 * 사용자 간 공유라 개인 지출 판정을 캐시하면 남의 분석에 번지므로 저장하지 않는다.
 */
function applyClassifications(
  txns: NormalizedTxn[],
  entries: Map<string, DictEntry>,
  personalKeys: Set<string>,
): ClassifiedTxn[] {
  return txns.map((txn) => {
    const key = merchantKey(txn.merchant);
    const entry = entries.get(key);

    if (entry) {
      return {
        ...txn,
        accountCode: entry.accountCode,
        verdict: entry.defaultVerdict,
      };
    }

    return {
      ...txn,
      accountCode: null,
      verdict: personalKeys.has(key) ? "personal" : "uncertain",
    };
  });
}

/** 판정별 건수만 센다. 상호명·금액은 담지 않는다. */
function verdictCounts(verdicts: readonly Verdict[]): Record<Verdict, number> {
  const counts: Record<Verdict, number> = {
    expense: 0,
    personal: 0,
    uncertain: 0,
  };

  for (const verdict of verdicts) {
    counts[verdict] += 1;
  }

  return counts;
}

/** Runs one upload inside Next.js after(); all failures are persisted and swallowed. */
export async function runAnalysis(
  userId: string,
  uploadId: string,
): Promise<void> {
  let stage: Stage = "load";
  let rowCount = 0;
  let expired = false;

  try {
    const upload = await getUploadForUser(userId, uploadId);
    if (!upload || upload.status === "completed") return;
    expired = Date.parse(upload.expiresAt) <= Date.now();

    const bytes = await downloadOriginalForUser(userId, upload.storagePath);
    stage = "parse";
    const encoding = detectEncoding(bytes);
    const rows = parseRows(decodeCsv(bytes, encoding));
    const fingerprint = headerFingerprint(rows.slice(0, FINGERPRINT_ROWS));

    stage = "mapping-cache";
    const cached = await readMapping(fingerprint);
    let headerRowIndex: number;
    let columnMap: ColumnMap;
    if (cached) {
      headerRowIndex = cached.header_row_index;
      columnMap = cached.column_map;
    } else {
      stage = "mapping";
      const mapped = await mapColumns(rows.slice(0, FINGERPRINT_ROWS));
      headerRowIndex = mapped.headerRowIndex;
      columnMap = mapped.columnMap;
      stage = "mapping-cache";
      await saveMapping(fingerprint, headerRowIndex, columnMap, encoding);
    }

    stage = "parse";
    const normalized = normalizeRows(rows, columnMap, headerRowIndex).txns;
    rowCount = normalized.length;
    stage = "classify";
    const keys = [...new Set(normalized.map((txn) => merchantKey(txn.merchant)))];
    const entries = await lookupMerchants(keys);
    const missingKeys = keys.filter((key) => !entries.has(key));
    const personalKeys = new Set<string>();
    let classifiedVerdicts: Verdict[] = [];
    if (missingKeys.length > 0) {
      const originalNameByKey = new Map(
        normalized.map((txn) => [merchantKey(txn.merchant), txn.merchant]),
      );
      const missingNames = missingKeys.map((key) => originalNameByKey.get(key)!);
      const verdicts = await classifyMerchants(missingNames);
      classifiedVerdicts = verdicts.map(({ verdict }) => verdict);
      const definite = verdicts.flatMap((verdict, index) => {
        const key = missingKeys[index]!;
        if (verdict.verdict === "personal") {
          personalKeys.add(key);
          return [];
        }
        if (verdict.verdict === "uncertain" || verdict.accountCode === null) {
          return [];
        }
        const entry: DictEntry = {
          merchantKey: key,
          accountCode: verdict.accountCode,
          defaultVerdict: verdict.verdict,
          reason: verdict.reason,
        };
        entries.set(entry.merchantKey, entry);
        return [entry];
      });
      await upsertMerchants(definite);
    }

    const classified = applyClassifications(normalized, entries, personalKeys);
    // 분류기 출력(고유 가맹점 단위)과 거래에 최종 적용된 판정(거래 단위)을 나란히
    // 남긴다. 둘이 어긋나면 판정이 조용히 강등되고 있다는 뜻이다.
    console.info(
      JSON.stringify({
        event: "classify_verdicts",
        uploadId,
        before: verdictCounts(classifiedVerdicts),
        after: verdictCounts(classified.map(({ verdict }) => verdict)),
      }),
    );
    stage = "persist";
    await deleteTransactionsForUser(userId, uploadId);
    await insertTransactionsForUser(userId, uploadId, classified);
    const summary = aggregate(classified);
    const period = txnPeriod(classified);
    await updateUploadForUser(userId, uploadId, {
      status: "completed",
      errorCode: null,
      summary,
      periodStart: period.start,
      periodEnd: period.end,
      rowCount: classified.length,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = errorCode(error, stage, expired);
    console.error(
      JSON.stringify({
        event: "analysis_failed",
        uploadId,
        code,
        rowCount,
        ...(llmKind(error) ? { llmKind: llmKind(error) } : {}),
        ...classifyDiagnosis(error),
      }),
    );
    try {
      await updateUploadForUser(userId, uploadId, {
        status: "failed",
        errorCode: code,
        finishedAt: new Date().toISOString(),
      });
    } catch {
      // No further recovery is possible, and after() must never reject.
    }
  }
}
