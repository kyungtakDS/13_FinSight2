import {
  lookupMerchants,
  merchantKey,
  upsertMerchants,
  type DictEntry,
} from "@/lib/classify/dictionary";
import { FINGERPRINT_ROWS, headerFingerprint } from "@/lib/csv/fingerprint";
import {
  collectStatusValues,
  decodeCsv,
  detectEncoding,
  normalizeRows,
  parseRows,
  RowLimitExceeded,
  RowsUnreadable,
  type CsvEncoding,
} from "@/lib/csv/normalize";
import { aggregate, txnPeriod } from "@/lib/report/aggregate";
import {
  createServiceClient,
  deleteTransactionsForUser,
  downloadOriginalForUser,
  getUploadForUser,
  insertTransactionsForUser,
  releaseUploadRecompute,
  replaceUploadResultForUser,
  updateUploadForUser,
} from "@/lib/supabase/service";
import {
  ClassifyBatchError,
  classifyMerchants,
  type MerchantVerdict,
} from "@/services/claude/classify-merchants";
import {
  ClaudeCallError,
  type ClaudeCallErrorKind,
  type ResponseShape,
  type UpstreamDetail,
} from "@/services/claude/client";
import { mapColumns } from "@/services/claude/map-columns";
import { mapStatusValues } from "@/services/claude/map-status";
import type { ColumnMap } from "@/types/csv";
import type { ErrorCode } from "@/types/errors";
import type { ClassifiedTxn, NormalizedTxn, Verdict } from "@/types/transaction";
import type { UploadErrorDetail } from "@/types/upload";

type Stage =
  | "load"
  | "parse"
  | "mapping-cache"
  | "mapping-columns"
  | "mapping-status"
  | "classify"
  | "persist";

type CachedMapping = {
  header_row_index: number;
  column_map: ColumnMap;
  encoding: CsvEncoding | null;
};

/**
 * mapping 단계는 CSV 를 읽는 단계가 아니라 Claude 를 부르는 단계다. 그 실패를
 * `parse_failed` 로 적으면 화면이 "CSV 파일을 읽지 못했습니다" 라고 말해 멀쩡한
 * 파일을 의심하게 만든다. Claude 실패는 어느 단계에서 나든 분석 실패다.
 */
function errorCode(error: unknown, stage: Stage, expired: boolean): ErrorCode {
  if (expired && stage === "load") return "expired";
  if (error instanceof RowLimitExceeded) return "too_large";
  if (error instanceof RowsUnreadable) return "rows_unreadable";
  if (error instanceof ClaudeCallError) {
    return error.kind === "upstream" ? "upstream" : "analysis_failed";
  }
  if (stage === "load" || stage === "parse") return "parse_failed";
  return "upstream";
}

function llmKind(error: unknown): ClaudeCallErrorKind | undefined {
  return error instanceof ClaudeCallError ? error.kind : undefined;
}

function upstreamDetailOf(error: unknown): UpstreamDetail | null {
  return error instanceof ClaudeCallError ? error.detail : null;
}

function responseShapeOf(error: unknown): ResponseShape | null {
  return error instanceof ClaudeCallError ? error.shape : null;
}

/**
 * JSON 이 아닌 응답의 형태. `json_parse` 만으로는 코드 펜스인지 설명문인지 빈
 * 응답인지 구분할 수 없어 다음 실패를 기다리는 것 말고 할 수 있는 게 없다.
 */
function responseShapeDiagnosis(error: unknown): Record<string, unknown> {
  return { ...responseShapeOf(error) };
}

/**
 * 상류 실패의 진단 정보. errorCode 는 클라이언트로 나가는 고정 어휘라 429 인지
 * 529 인지 400 인지 구분하지 못한다 — 그 구분이 여기 남아야 재현을 기다리지 않는다.
 */
function upstreamDiagnosis(error: unknown): Record<string, unknown> {
  const detail = upstreamDetailOf(error);
  if (!detail) {
    return {};
  }
  return {
    upstreamStatus: detail.status,
    upstreamErrorType: detail.errorType,
    upstreamRequestId: detail.requestId,
    upstreamRetryable: detail.retryable,
  };
}

function errorNameOf(error: unknown): string | null {
  return error instanceof Error && error.name !== "" ? error.name : null;
}

/**
 * PostgrestError 에서 code 만 가져온다. message·details·hint 에는 위반한 행의
 * 값이 그대로 실려 오므로 담지 않는다.
 */
function databaseCode(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const { code } = error as { code?: unknown };
  return typeof code === "string" && code !== "" ? code : null;
}

/**
 * 실패의 출처를 가려 낸다. 진단을 ClaudeCallError 에만 달아 두면, 정작 Claude 와
 * 무관한 실패(DB·코드 오류)에는 아무 단서도 남지 않는다 — errorCode 가 그것마저
 * 'upstream' 이라 부르기 때문에 Claude 장애로 오독하게 된다.
 */
function errorDetailOf(error: unknown, stage: Stage): UploadErrorDetail {
  const upstream = upstreamDetailOf(error);
  if (upstream) {
    return {
      source: "claude",
      stage,
      errorName: errorNameOf(error),
      ...upstream,
    };
  }

  // 응답 형태가 남아 있다는 건 Claude 가 답을 주긴 했다는 뜻이다. 이걸 놓치면
  // 상류 detail 이 없다는 이유로 우리 쪽 코드 오류처럼 기록된다.
  const shape = responseShapeOf(error);
  if (shape) {
    return {
      source: "claude",
      stage,
      errorName: errorNameOf(error),
      status: null,
      errorType: null,
      requestId: null,
      retryable: false,
      responseShape: shape,
    };
  }

  const code = databaseCode(error);
  return {
    source: code === null ? "internal" : "database",
    stage,
    errorName: errorNameOf(error),
    status: null,
    errorType: code,
    requestId: null,
    retryable: false,
  };
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

/**
 * 사전에 캐시할 수 있는 판정만 엔트리로 바꾼다. personal 은 남기지 않는다 —
 * merchant_dictionary 는 merchant_key 단독 PK 로 사용자 간 공유라, 한 사람의
 * 개인 지출 판정이 남의 분석에 번지면 안 된다.
 */
function cacheableEntries(
  names: string[],
  verdicts: MerchantVerdict[],
): DictEntry[] {
  return verdicts.flatMap((verdict, index) => {
    if (verdict.verdict !== "expense" || verdict.accountCode === null) {
      return [];
    }
    const entry: DictEntry = {
      merchantKey: merchantKey(names[index]!),
      accountCode: verdict.accountCode,
      defaultVerdict: verdict.verdict,
      reason: verdict.reason,
    };
    return [entry];
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

type RunAnalysisOptions = {
  /**
   * 이미 completed 인 업로드를 다시 계산한다. 최초 분석과 다른 점은 결과를 언제
   * 쓰느냐 하나다 — 새 결과가 나온 뒤에만 기존 결과를 통째로 교체하고, 실패하면
   * 아무것도 건드리지 않는다.
   */
  recompute?: boolean;
};

/** Runs one upload inside Next.js after(); all failures are persisted and swallowed. */
export async function runAnalysis(
  userId: string,
  uploadId: string,
  options?: RunAnalysisOptions,
): Promise<void> {
  const recompute = options?.recompute === true;
  let stage: Stage = "load";
  // 0 은 "0행을 정규화했다" 는 측정값처럼 읽힌다. 정규화에 도달하지 못했으면
  // 측정 자체가 없었다는 뜻이라 null 이어야 한다.
  let rowCount: number | null = null;
  let expired = false;

  try {
    const upload = await getUploadForUser(userId, uploadId);
    if (!upload) return;
    if (upload.status === "completed" && !recompute) return;
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
    let mappingChanged = false;
    if (cached) {
      headerRowIndex = cached.header_row_index;
      columnMap = cached.column_map;
    } else {
      stage = "mapping-columns";
      const mapped = await mapColumns(rows.slice(0, FINGERPRINT_ROWS));
      headerRowIndex = mapped.headerRowIndex;
      columnMap = mapped.columnMap;
      mappingChanged = true;
    }

    // 상태값의 의미는 카드사마다 다르므로 코드가 아니라 모델이 판정한다. 사전은
    // 양식 단위라 같은 카드사 파일을 다시 올리면 LLM 호출 없이 캐시로 끝난다.
    const knownRules = columnMap.txnTypeRules ?? {};
    const newStatusValues = collectStatusValues(rows, columnMap, headerRowIndex)
      .filter((value) => !(value in knownRules));
    let statusUnresolved = false;
    if (newStatusValues.length > 0) {
      stage = "mapping-status";
      const mapped = await mapStatusValues(newStatusValues);
      statusUnresolved = mapped.unresolved > 0;
      if (statusUnresolved) {
        console.warn(
          JSON.stringify({
            event: "status_mapping_fallback",
            uploadId,
            unresolved: mapped.unresolved,
            llmKind: mapped.failureKind,
          }),
        );
      }
      // 판정된 값만 캐시에 싣는다. 폴백한 normal 을 굳히면 이 양식의 이후 업로드가
      // 조용히 오염되고, 재시도가 같은 값을 다시 물어볼 기회도 사라진다.
      if (Object.keys(mapped.rules).length > 0) {
        columnMap = {
          ...columnMap,
          txnTypeRules: { ...knownRules, ...mapped.rules },
        };
        mappingChanged = true;
      }
    }

    if (mappingChanged) {
      stage = "mapping-cache";
      await saveMapping(fingerprint, headerRowIndex, columnMap, encoding);
    }

    stage = "parse";
    const { txns: normalized, skipped, excluded } = normalizeRows(rows, columnMap, headerRowIndex);
    rowCount = normalized.length;
    // 세 갈래가 데이터 행을 정확히 나눠 가진다 — 읽었거나, 제외했거나, 못 읽었거나.
    const inputRows = normalized.length + skipped + excluded;
    if (skipped > 0) {
      console.info(
        JSON.stringify({
          event: "normalize_rows",
          uploadId,
          inputRows,
          normalized: normalized.length,
          skipped,
        }),
      );
    }
    // 거래가 하나도 남지 않는 원인은 둘이고, 사용자가 할 일이 서로 다르다.
    // skipped 는 날짜·가맹점·금액 해석에 실패한 것이라 원본을 다시 받아야 하지만,
    // excluded 는 승인취소로 정상 판정되어 빠진 것이라 할 일이 없다. 후자까지
    // 실패로 부르면 멀쩡한 파일을 다시 올리라고 안내하게 되고, 다시 올려도 결과가
    // 같아 빠져나올 수 없다 (#36). 전부 못 읽은 경우만 실패로 남긴다.
    if (skipped > 0 && normalized.length === 0) {
      throw new RowsUnreadable();
    }
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
      // 배치가 끝날 때마다 곧바로 사전에 넣는다. 뒤 배치가 죽어도 앞 배치의 LLM
      // 결과는 남아, 재시도가 캐시 적중으로 시작해 남은 만큼만 다시 분류한다.
      // 최종 상태는 반환값으로 만든다 — 콜백이 불렸는지에 정확성이 걸리면 안 된다.
      const verdicts = await classifyMerchants(missingNames, {
        onBatchComplete: async ({ names: batchNames, verdicts: batchVerdicts }) => {
          const definite = cacheableEntries(batchNames, batchVerdicts);
          if (definite.length > 0) {
            await upsertMerchants(definite);
          }
        },
      });

      classifiedVerdicts = verdicts.map(({ verdict }) => verdict);
      verdicts.forEach((verdict, index) => {
        if (verdict.verdict === "personal") {
          personalKeys.add(missingKeys[index]!);
        }
      });
      for (const entry of cacheableEntries(missingNames, verdicts)) {
        entries.set(entry.merchantKey, entry);
      }
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
    const summary = aggregate(classified, excluded, statusUnresolved, skipped);
    const period = txnPeriod(classified);
    // 재계산은 새 결과가 손에 들어온 뒤에야 기존 결과를 건드린다. 먼저 지우면
    // 그 사이의 실패가 사용자에게서 멀쩡한 보고서를 빼앗는다.
    if (recompute) {
      await replaceUploadResultForUser(userId, uploadId, classified, {
        summary,
        periodStart: period.start,
        periodEnd: period.end,
        rowCount: classified.length,
      });
      return;
    }
    await deleteTransactionsForUser(userId, uploadId);
    await insertTransactionsForUser(userId, uploadId, classified);
    await updateUploadForUser(userId, uploadId, {
      status: "completed",
      errorCode: null,
      errorDetail: null,
      summary,
      periodStart: period.start,
      periodEnd: period.end,
      rowCount: classified.length,
      finishedAt: new Date().toISOString(),
    });
  } catch (error) {
    const code = errorCode(error, stage, expired);
    const detail = errorDetailOf(error, stage);
    console.error(
      JSON.stringify({
        event: "analysis_failed",
        uploadId,
        ...(recompute ? { recompute: true } : {}),
        code,
        rowCount,
        stage,
        errorSource: detail.source,
        errorName: detail.errorName,
        errorType: detail.errorType,
        ...(llmKind(error) ? { llmKind: llmKind(error) } : {}),
        ...upstreamDiagnosis(error),
        ...responseShapeDiagnosis(error),
        ...classifyDiagnosis(error),
      }),
    );
    try {
      // 재계산 실패는 저장된 결과를 건드리지 않는다. status·summary·error_code·
      // retry_count 를 그대로 두고 잠금만 푼다 — 사용자가 보던 보고서는 그대로고,
      // 실패한 재계산이 멀쩡한 업로드를 failed 로 떨어뜨리지도 않는다.
      if (recompute) {
        await releaseUploadRecompute(userId, uploadId);
      } else {
        await updateUploadForUser(userId, uploadId, {
          status: "failed",
          errorCode: code,
          errorDetail: detail,
          rowCount,
          finishedAt: new Date().toISOString(),
        });
      }
    } catch (recordError) {
      // after() 는 절대 reject 하면 안 되지만, 조용히 삼키면 업로드가 processing
      // 에 영원히 갇힌 채 이유가 남지 않는다.
      console.error(
        JSON.stringify({
          event: "analysis_record_failed",
          uploadId,
          errorName: errorNameOf(recordError),
          errorType: databaseCode(recordError),
        }),
      );
    }
  }
}
