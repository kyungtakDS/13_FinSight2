# Step 4: uploads-retry

## 목적

`POST /api/uploads/[id]/retry` — 실패한 분석을 다시 돌린다. **최대 2회.**

재시도는 Storage에서 원본을 다시 읽어 같은 경로를 탄다. **원본을 90일간 보관하기로 한 결정이 재시도를 가능하게 만든다**(ARCHITECTURE.md) — 90일이 지난 분석은 재시도할 수 없고, UI가 그렇게 말해야 한다.

## 이전 Step과의 의존성

- **step 1 (`analysis-pipeline`)** — `runAnalysis(userId, uploadId)`. 재실행 시 기존 `transactions`를 지우고 다시 넣는 것이 이미 보장돼 있다
- **step 2 (`uploads-ingest`)** — `after()` 사용 패턴과 `maxDuration`
- **step 3 (`uploads-detail`)** — 404 규칙, `userId` 스코프 헬퍼

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §분석은 비동기 잡이다 · §데이터 흐름의 재시도 문단 · §오류 처리
- `/docs/ADR.md` — ADR-005(90일 만료가 재시도를 제한한다) · ADR-017 · 폐기된 결정 표의 "`retry_count` 상한 2는 비용 방어로 존치"
- `/docs/PRD.md` — UC-12(최대 2회)
- `/docs/DESIGN.md` — §6의 `failed` 상태 (재시도 버튼 + 잔여 횟수 표시, `expired`면 재시도 불가 사유)
- `/src/lib/analysis/run-analysis.ts` · `/src/app/api/uploads/route.ts` · `/src/app/api/uploads/[id]/route.ts`

## 구현 범위

```
src/app/api/uploads/[id]/retry/route.ts   — POST
```

```ts
export const runtime = 'nodejs';
export const maxDuration = 300;    // 접수 라우트와 같은 이유 — 같은 파이프라인이 돈다

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
```

## 수정 대상 파일

```
src/app/api/uploads/[id]/retry/route.ts        (신규)
src/app/api/uploads/[id]/retry/route.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

### 인증·소유권
1. 세션 없으면 401
2. 없는 id → 404
3. 타인의 업로드 → 404 (403 아님)

### 상태 조건
4. `status: 'failed'`가 아니면 **409**. `processing` 중인 것을 다시 돌리면 같은 파이프라인이 두 개 돈다
5. `status: 'completed'`도 409 (성공한 분석을 다시 돌릴 이유가 없다)

### 횟수 상한 ← 비용 방어
6. `retry_count`가 2면 **거절한다** (429 또는 409 + 고정 어휘)
7. 성공 경로에서 `retry_count`가 **1 증가한다**
8. **증가가 `after()` 예약 전에, DB에 반영된 뒤에 일어난다** — 순서를 바꾸면 두 번 눌러 두 번 도는 창이 생긴다
9. `retry_count` 증가와 `status: 'processing'` 전환이 같은 UPDATE다
10. 응답에 남은 횟수가 실린다 (DESIGN.md: "재시도 버튼(잔여 횟수 표시)")

### 만료 ← 90일이 재시도를 제한한다
11. `expires_at`이 지났거나 `storage_path`가 `null`이면 **`expired`**로 거절한다 (고정 어휘)
12. 만료 거절 시 `retry_count`가 증가하지 **않는다** — 시도조차 못 했다
13. 만료 검사가 횟수 검사보다 **먼저**다 (원본이 없으면 횟수가 남아도 소용없다)

### 실행
14. 조건을 통과하면 `after()`로 `runAnalysis(userId, uploadId)`가 예약된다
15. **`after()`를 `await`하지 않는다**
16. 202를 반환한다
17. `error_code`가 초기화된다 (이전 실패 사유가 남아 있으면 화면이 헷갈린다)
18. `finished_at`이 초기화된다

### 멱등
19. 같은 요청을 연속 두 번 보내면 두 번째는 409다 (첫 번째가 `processing`으로 바꿨으므로)

### 로깅
20. 파일명·가맹점명이 로그에 없다

## Codex 실행 지시문

### 검사 순서

```
1. 인증
2. userId 스코프 조회 → 없으면 404
3. 만료 검사 (expires_at 경과 또는 storage_path is null) → expired
4. status === 'failed' 인가 → 아니면 409
5. retry_count < 2 인가 → 아니면 거절
6. UPDATE: retry_count + 1, status = 'processing', error_code = null, finished_at = null
7. 202 반환
8. after(() => runAnalysis(...))
```

**3번이 5번보다 먼저다.** 원본이 없으면 횟수가 남아 있어도 아무 소용이 없고, "재시도 2회 남았는데 왜 안 되지"보다 "원본이 만료됐다"가 정확한 안내다.

### 상태 전환이 `after()` 예약보다 먼저

```ts
await updateUploadForUser(userId, id, { retry_count: n + 1, status: 'processing', error_code: null, finished_at: null });
const res = Response.json({ retriesLeft: 2 - (n + 1) }, { status: 202 });
after(() => runAnalysis(userId, id));
return res;
```

순서를 뒤집으면 사용자가 버튼을 두 번 눌렀을 때 두 파이프라인이 같은 업로드에 동시에 돈다. `status`를 먼저 `processing`으로 바꿔두면 두 번째 요청이 4번 검사에서 걸린다.

> 완벽한 원자성은 아니다 (읽기-쓰기 사이 경쟁). 하지만 **락이나 advisory lock을 도입하지 마라** — 최악의 결과가 "분석 한 번 더 도는 것"이고, `runAnalysis`가 기존 `transactions`를 지우고 다시 넣으므로 데이터가 깨지지 않는다. 그 정도 위험에 인프라를 늘리지 않는다.

### 거절 응답의 어휘

- 만료 → `{ "error": "expired" }`
- 횟수 초과 → 어휘 7개에 딱 맞는 것이 없다. **어휘를 늘리지 마라.** HTTP 409 + `{ "error": "analysis_failed" }`로 하고 응답에 `retriesLeft: 0`을 실어 화면이 정확한 문구를 고르게 하라
- 상태 부적합 → 409

화면이 문구를 고를 근거는 `error` 어휘 + `retriesLeft` 숫자다. 새 어휘를 만드는 대신 숫자를 준다.

### `runAnalysis`가 재실행 안전한지 확인하라

step 1의 요구사항: *"재실행 시 기존 `transactions`를 지우고 다시 넣는다."* 그 테스트가 실제로 있는지 확인하라. 없으면 이 step에서 `runAnalysis`를 고치지 말고 **`error_message`에 그 사실을 적고 실패시켜라** — 다른 step의 산출물을 몰래 고치면 그 step의 `summary`가 거짓이 된다.

## 완료 조건

- `POST`가 있고 20개 테스트가 전부 통과한다
- 만료 검사가 횟수 검사보다 먼저다
- 상태 전환이 `after()` 예약보다 먼저다
- `retry_count` 상한이 2다
- 응답에 `retriesLeft`가 있다
- 에러 어휘가 7개 안에 있다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run "src/app/api/uploads/[id]/retry/route.test.ts"
```

직접 확인:

```bash
grep -n "await after" "src/app/api/uploads/[id]/retry/route.ts" && echo "FAIL" || echo "OK"
grep -nE "advisory_lock|pg_advisory" "src/app/api/uploads/[id]/retry/route.ts" && echo "FAIL: 락 도입" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `api/uploads/[id]/retry/route.ts` 위치인가?
   - ADR-005 — 90일 만료가 재시도를 제한하는가?
   - ADR-017 — `after()`를 `await`하지 않는가? `maxDuration`이 있는가?
   - AGENTS.md CRITICAL — 에러가 고정 어휘 7개인가? 로그에 PII 없는가?
   - 새 라우트를 문서에 있는 것 외에 만들지 않았는가?
3. 결과에 따라 `phases/2-api/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/api/uploads/[id]/retry/route.ts — POST: 404→만료(expired)→status failed 확인(409)→retry_count<2 확인→UPDATE(count+1, processing, error_code/finished_at 초기화)→202 {retriesLeft}→after(runAnalysis). 만료 검사가 횟수 검사보다 먼저, 상태 전환이 after 예약보다 먼저. 락 미도입")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(2-api): step 4 — uploads-retry`

포함: `src/app/api/uploads/[id]/retry/route.{ts,test.ts}`

## 금지사항

- **`after()` 예약 뒤에 상태를 전환하지 마라.** 이유: 두 번 눌러 두 파이프라인이 동시에 도는 창이 생긴다.
- **advisory lock·분산 락을 도입하지 마라.** 이유: 최악의 결과가 "분석 한 번 더 도는 것"이고 `runAnalysis`가 재실행 안전하다. 그 정도 위험에 인프라를 늘리지 않는다(ADR 폐기된 결정 표: "한도 두 겹 — advisory lock 원자 접수 함수" 폐기).
- **`retry_count` 상한을 늘리거나 없애지 마라.** 이유: 횟수제 과금은 폐기됐지만 `retry_count` 상한 2는 **비용 방어로 존치**됐다.
- **만료 검사를 횟수 검사 뒤로 미루지 마라.** 이유: 원본이 없으면 횟수가 남아도 소용없고, 안내 문구가 틀려진다.
- **에러 어휘를 늘리지 마라.** 이유: 7개 고정이다. 화면이 문구를 고를 근거는 어휘 + `retriesLeft` 숫자다.
- **`completed`인 분석을 다시 돌리게 하지 마라.** 이유: 비용을 태우고 결과가 바뀔 수도 있어 사용자를 혼란시킨다.
- **`runAnalysis`나 다른 step의 파일을 고치지 마라.** 이유: 다른 step의 `summary`가 거짓이 된다. 문제가 있으면 `error_message`에 적고 실패시켜라.
- **`after()`를 `await`하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
