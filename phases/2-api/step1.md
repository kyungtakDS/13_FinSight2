# Step 1: analysis-pipeline

## 목적

Phase 1이 만든 조각들을 **하나의 파이프라인으로 잇는다.** `after()` 안에서 도는 오케스트레이션이다.

```
Storage 원본 → 인코딩 감지 → 파싱 → 헤더 지문
   → csv_format_mappings 조회 ─ 히트 → 즉시 정규화              [LLM 0회]
                              └ 미스 → 상위 20행만 Claude → 매핑 저장  [LLM 1회, 전역 재사용]
정규화 행 → 상호명 추출 → merchant_dictionary 조회
   ├ 히트 (대부분) → 즉시 분류                                    [LLM 0회]
   └ 미스 → 상호명 배열만 배치 전송 → 사전 갱신                    [LLM 1회, 전역 재사용]
→ 미판정 건은 `uncertain`으로 확정 (실패 아님)
→ transactions 저장 → aggregate → uploads.summary 갱신
```

**LLM 호출은 항상 캐시 조회 뒤에 온다.** 캐시를 우회하는 직접 호출 경로를 만들지 않는다(ARCHITECTURE.md §패턴).

> `src/lib/analysis/run-analysis.ts`는 ARCHITECTURE.md의 디렉토리 목록에 없다. `phases/PLAN.md` D-7에서 승인한 추가 파일이다 — 라우트 핸들러에 넣으면 유닛테스트가 HTTP를 거쳐야 한다.

## 이전 Step과의 의존성

Phase 1 전체 + Phase 0 전체가 `completed`여야 한다. 직접 import하는 것 전부:

- `lib/csv/normalize.ts` — `detectEncoding`·`decodeCsv`·`parseRows`·`normalizeRows`
- `lib/csv/fingerprint.ts` — `headerFingerprint`·`FINGERPRINT_ROWS`
- `services/claude/map-columns.ts` — `mapColumns`
- `services/claude/classify-merchants.ts` — `classifyMerchants`
- `lib/classify/dictionary.ts` — `lookupMerchants`·`upsertMerchants`·`merchantKey`
- `lib/report/aggregate.ts` — `aggregate`·`txnPeriod`
- `lib/supabase/service.ts` — `downloadOriginalForUser`·`updateUploadForUser`·`insertTransactionsForUser`·`createServiceClient`
- `types/errors.ts` — 고정 어휘 7개

**Phase 1의 각 step `summary`를 읽어라** — 함수 시그니처가 거기 요약돼 있다.

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§데이터 흐름 전문** · §분석은 비동기 잡이다 · §Supabase 키 사용 규칙 · §오류 처리
- `/docs/ADR.md` — ADR-001 · ADR-013(두 층의 실패) · ADR-017(`after()`) · ADR-018
- `/docs/PRD.md` — §분류 실패 처리 표 (파이프라인 실패 vs 개별 거래 불확실)
- Phase 1의 모든 산출물 파일 (위 목록)
- `/phases/1-pipeline/index.json` — 각 step의 `summary`
- `/phases/PLAN.md` — D-7

## 구현 범위

`src/lib/analysis/run-analysis.ts` 하나.

```ts
/**
 * 업로드 1건을 분석한다. after() 안에서 호출된다.
 * 절대 throw하지 않는다 — 모든 실패를 uploads.status='failed' + error_code 로 기록한다.
 */
export async function runAnalysis(userId: string, uploadId: string): Promise<void>;
```

## 수정 대상 파일

```
src/lib/analysis/run-analysis.ts        (신규)
src/lib/analysis/run-analysis.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

의존 모듈을 전부 `vi.mock`한다. **실제 DB·Storage·API 키가 필요하면 안 된다.**

### 캐시 우선 ← ADR-001의 핵심
1. **`csv_format_mappings` 히트면 `mapColumns`(LLM)를 부르지 않는다**
2. 미스면 `mapColumns`를 부르고 **결과를 `csv_format_mappings`에 저장한다**
3. **모든 상호명이 사전에 있으면 `classifyMerchants`(LLM)를 부르지 않는다**
4. 미스가 있으면 **미스만** 보낸다 — 히트한 상호명이 LLM 페이로드에 없다
5. LLM 결과가 `upsertMerchants`로 사전에 적재된다
6. **양쪽 다 히트면 LLM 호출이 0회다** (전역 사전이 채워졌을 때의 정상 경로)

### 두 층의 실패 ← 섞으면 안 된다
7. `downloadOriginalForUser` 실패 → `status: 'failed'` + `error_code: 'parse_failed'`
8. `RowLimitExceeded` → `status: 'failed'` + `error_code: 'too_large'`
9. `mapColumns`가 `ClaudeCallError`를 던지면 → `status: 'failed'` + `error_code: 'parse_failed'` (사용자에게 매핑 실패와 파싱 실패는 같은 말이다 — ARCHITECTURE.md §오류 처리)
10. `classifyMerchants`가 `kind: 'refusal'`·`'max_tokens'`·`'context_exceeded'`를 던지면 → `error_code: 'analysis_failed'`
11. `kind: 'upstream'` → `error_code: 'upstream'`
12. **사전에 없고 LLM도 `uncertain`을 답한 거래는 `verdict: 'uncertain'`으로 저장되고 `status`는 `'completed'`다** — 개별 거래 실패가 분석을 죽이지 않는다(ADR-013)
13. **`runAnalysis`가 어떤 경우에도 throw하지 않는다.** 의존 모듈이 전부 던지도록 mock해도 resolve한다. 이유: `after()` 안에서 던지면 잡을 곳이 없고 행이 `processing`에 영원히 남는다

### 저장
14. `transactions`가 `insertTransactionsForUser(userId, ...)`로 저장된다 — service role 헬퍼의 `userId` 첫 인자
15. 각 행의 `rowIndex`가 원본 기준이다
16. `uploads`가 `status: 'completed'` · `summary` · `period_start`/`period_end` · `row_count` · `finished_at`으로 갱신된다
17. 실패 시에도 `finished_at`이 찍힌다

### PII 로깅 ← AGENTS.md CRITICAL
18. **성공·실패 어느 경로에서도 로그에 가맹점명이 없다.** `console` 전 메서드를 spy하고 인자를 전부 문자열로 이어붙여 픽스처의 고유 상호명이 없음을 assert하라
19. 로그에 CSV 내용·카드번호가 없다
20. 실패 로그에 **에러 코드와 행 수만** 있다

### 멱등·재진입
21. 이미 `completed`인 업로드에 대해 호출되면 아무것도 하지 않는다 (재시도 경로에서 중복 실행 방어)
22. 재실행 시 기존 `transactions`를 지우고 다시 넣는다 — 두 배로 쌓이면 안 된다

## Codex 실행 지시문

### 절대 throw하지 않는다

```ts
export async function runAnalysis(userId: string, uploadId: string): Promise<void> {
  try {
    // … 전체 파이프라인
  } catch (e) {
    await markFailed(userId, uploadId, toErrorCode(e));   // 여기서도 throw 금지
  }
}
```

`after()` 안에서 던진 예외는 잡을 곳이 없다. 던지면 `uploads.status`가 `processing`에 영원히 남고, 사용자는 끝나지 않는 스피너를 본다.

`markFailed` 자체가 실패할 수도 있다. 그것도 삼켜라 — 더 할 수 있는 게 없다.

### 에러 → 고정 어휘 매핑

클라이언트로 나가는 어휘는 7개뿐이다. 매핑을 한 함수에 모아라:

| 원인 | `error_code` |
|---|---|
| Storage 읽기 실패 · 디코드 실패 · 파싱 실패 · **컬럼 매핑 실패** | `parse_failed` |
| 3,000행 초과 · 2MB 초과 | `too_large` |
| `ClaudeCallError` refusal / max_tokens / context_exceeded | `analysis_failed` |
| `ClaudeCallError` upstream · DB 오류 | `upstream` |
| 원본이 90일 만료로 사라짐 | `expired` |

**매핑 실패와 파싱 실패를 다른 코드로 나누지 마라.** 사용자에게 둘 다 "이 파일을 읽지 못했습니다"다. 진단용 구분은 서버 로그에만 남긴다(ARCHITECTURE.md §오류 처리).

### 로깅 — 에러 코드와 행 수만

```ts
// ❌ console.error('분류 실패', merchant, rows);
// ✅ console.error(JSON.stringify({ event: 'analysis_failed', uploadId, code, rowCount, llmKind }));
```

`uploadId`는 남겨도 된다 (PII가 아니다). **가맹점명·금액·CSV 내용·파일명은 안 된다.**

`llmKind`(refusal/max_tokens/context_exceeded)는 남겨라 — 세 가지를 구분해 남기는 것이 ARCHITECTURE.md §Claude API의 요구사항이다.

### service role 사용

`after()` 안에서는 요청 컨텍스트가 사라질 수 있으므로 service role을 쓴다(ADR-017). **반드시 `userId`를 첫 인자로 받는 헬퍼를 통해서만** 접근하라 — 원시 클라이언트로 직접 쿼리하지 마라.

예외: `merchant_dictionary`·`csv_format_mappings`는 사용자 소유가 아니므로 `lib/classify/dictionary.ts`와 여기의 포맷 매핑 조회/저장이 `createServiceClient()`를 직접 쓴다.

### `csv_format_mappings` 조회/저장

이 파일이 담당한다 (사전과 달리 별도 모듈이 없다). 저장 시 `header_fingerprint`가 PK이므로 upsert. **경쟁 조건에서 중복 INSERT가 나도 무해하다** — 같은 지문이면 같은 매핑이다. 락을 걸지 마라.

**저장 페이로드에 사용자 식별자를 넣지 마라** — 전역 공유 테이블이다.

### 재실행 시 기존 거래 삭제

재시도 경로(step 4)가 같은 `uploadId`로 이 함수를 다시 부른다. `transactions`를 지우고 다시 넣어라. 안 지우면 두 배로 쌓이고 합계가 두 배가 된다.

### `uncertain` 확정

사전에도 없고 LLM도 `uncertain`을 답한 거래는 `verdict: 'uncertain'` · `accountCode: null`로 저장한다. **이건 실패가 아니다.** `status`는 `completed`다(ADR-013).

## 완료 조건

- `runAnalysis(userId, uploadId)`가 존재하고 22개 테스트가 전부 통과한다
- **어떤 경우에도 throw하지 않는다**
- 캐시 히트 시 LLM 호출이 0회다
- 에러가 고정 어휘 7개로만 매핑된다
- 로그에 가맹점명·CSV 내용이 없다
- 재실행 시 `transactions`가 중복되지 않는다
- 실제 DB·Storage·API 키 없이 테스트가 돈다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/analysis/run-analysis.test.ts
```

직접 확인:

```bash
grep -nE "console\.(log|error|warn|info)" src/lib/analysis/run-analysis.ts
# → 각 호출의 인자에 merchant/amount/row 값이 없는지 눈으로 확인
grep -n "throw" src/lib/analysis/run-analysis.ts
# → runAnalysis 밖으로 나가는 throw 가 없는지 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §데이터 흐름의 순서와 코드가 1:1인가?
   - §패턴 — LLM 호출이 항상 캐시 조회 뒤에 오는가? 캐시 우회 경로가 없는가?
   - ADR-013 — 파이프라인 실패와 개별 거래 불확실이 섞이지 않는가?
   - ADR-017 — `after()` 안에서 throw하지 않는가?
   - AGENTS.md CRITICAL — service role 헬퍼를 `userId` 첫 인자로 쓰는가? 로그에 PII 없는가? 클라이언트 에러가 고정 어휘인가?
   - 전역 사전 2개 테이블에 사용자 식별자를 안 넣는가?
3. 결과에 따라 `phases/2-api/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/analysis/run-analysis.ts — runAnalysis(userId, uploadId). Storage→디코드→파싱→지문→포맷매핑 캐시(미스만 LLM①)→정규화→사전 조회(미스만 LLM②)→사전 적재→transactions 재삽입→aggregate→uploads 갱신. 절대 throw 안 함, 에러는 고정 어휘 7개로 매핑, 로그는 code+rowCount+llmKind만")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(2-api): step 1 — analysis-pipeline`

포함: `src/lib/analysis/run-analysis.{ts,test.ts}`

## 금지사항

- **`runAnalysis`가 throw하게 두지 마라.** 이유: `after()` 안에서 던지면 잡을 곳이 없고 행이 `processing`에 영원히 남는다(ADR-017).
- **캐시를 우회하는 LLM 호출 경로를 만들지 마라.** 이유: ADR-001의 원가 구조 전체가 "모르는 것만 묻는다"에 얹혀 있다.
- **개별 거래 판정 실패로 분석 전체를 실패시키지 마라.** 이유: 거래 하나를 판정 못 했다고 300건짜리 분석을 버리면 사용자는 아무것도 못 얻는다(ADR-013).
- **매핑 실패와 파싱 실패를 다른 에러 코드로 나누지 마라.** 이유: 사용자가 취할 행동이 같으면 같은 코드다.
- **로그에 가맹점명·금액·CSV 내용·파일명을 남기지 마라.** 이유: AGENTS.md CRITICAL. 에러 코드와 행 수만.
- **service role 원시 클라이언트로 사용자 테이블을 직접 쿼리하지 마라.** 이유: `userId` 필수 헬퍼를 우회하면 RLS 우회 상태에서 스코프가 빠진다.
- **`csv_format_mappings`·`merchant_dictionary`에 사용자 식별자를 넣지 마라.**
- **재실행 시 기존 `transactions`를 남겨두지 마라.** 이유: 두 배로 쌓이면 합계가 두 배가 된다.
- **큐·워커·백그라운드 잡 인프라를 도입하지 마라.** 이유: `after()` + `maxDuration`으로 충분하다고 결정했다(ADR-017).
- **진행률 퍼센트를 계산해 DB에 저장하지 마라.** 이유: 상태는 3개뿐이고, 근거 없는 퍼센트는 지어낸 숫자다(DESIGN.md §7).
- **HTTP·라우트 코드를 여기 넣지 마라** — 다음 step이다.
- 기존 테스트를 깨뜨리지 마라.
