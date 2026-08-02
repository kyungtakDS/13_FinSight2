# Step 3: uploads-detail

## 목적

`GET /api/uploads/[id]` — 업로드 1건 조회. **게이트가 자른 페이로드**를 반환한다. 브라우저가 2초 간격으로 폴링하는 대상이기도 하다.
`DELETE /api/uploads/[id]` — 삭제. **Storage 객체 → DB 행** 순서로 두 단계를 명시적으로 수행한다.

두 가지 규칙이 여기서 지켜져야 한다:

1. **타인의 업로드는 403이 아니라 404다** — 403은 존재를 알려준다(ARCHITECTURE.md)
2. **DB 행 삭제는 Storage 객체를 지우지 않는다** — 순서를 명시적으로 밟아야 한다

## 이전 Step과의 의존성

- **step 0 (`gate`)** — `gateReport(plan, summary, txns)`
- **step 2 (`uploads-ingest`)** — `uploads` 행의 형태, GET 목록과의 일관성
- **Phase 0 step 4** — `getProfilePlan`·`deleteOriginalForUser`·`getUploadForUser`

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §게이트는 서버가 자른다 · §삭제 정합성 · §RLS(타인 접근은 404) · §분석은 비동기 잡이다(폴링)
- `/docs/ADR.md` — ADR-019(게이트) · ADR-005(90일 만료) · ADR-008
- `/docs/PRD.md` — UC-05 · UC-08 · UC-10 · UC-11
- `/src/lib/gate.ts` · `/src/app/api/uploads/route.ts` — 이전 step 산출물
- `/src/lib/supabase/service.ts`

## 구현 범위

```
src/app/api/uploads/[id]/route.ts   — GET + DELETE
```

```ts
export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
```

Next 15에서 `params`는 Promise다. `await`하라.

## 수정 대상 파일

```
src/app/api/uploads/[id]/route.ts        (신규)
src/app/api/uploads/[id]/route.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

### 인증·소유권 ← 404가 정답이다
1. 세션 없으면 401
2. **존재하지 않는 id → 404**
3. **다른 사용자의 업로드 → 404** (403이 아니다. `existsButNotYours` 같은 힌트도 없다)
4. GET·DELETE 모두 같은 규칙
5. 응답 본문이 존재 여부를 암시하지 않는다 (두 404의 본문이 동일하다)

### GET — 게이트 ← 이 step의 핵심
6. `free` 사용자의 응답 JSON에 **거래 행이 0개**다
7. **응답 JSON 문자열 전체에 어떤 가맹점명도 없다.** 픽스처에 고유 상호명을 심고 검사하라
8. `free` 응답의 인사이트가 3개다
9. `pro` 응답에 거래 전부와 인사이트 전부가 있다
10. `plan`을 **서버가 DB에서 읽는다** — 요청 본문·쿼리·헤더의 plan 값을 무시한다. `?plan=pro`를 붙여도 free 응답이 나온다
11. `status: 'processing'`이면 `summary`가 없고 상태만 반환한다 (폴링 대상)
12. `status: 'failed'`면 `error_code`가 반환된다
13. **거래 행 조회 자체를 `free`일 때 건너뛴다** — 읽어서 버리지 말고 아예 안 읽는다 (DB 부하 + 실수로 직렬화될 여지 제거)

### GET — 만료
14. `expires_at`이 지난 업로드도 **리포트는 그대로 나온다.** 사라지는 것은 원본 파일뿐이다(ADR-005)
15. 만료된 업로드는 `canRetry: false`로 표시된다 — UI가 재시도 불가 사유를 말해야 한다

### DELETE ← 순서가 핵심
16. **Storage 객체 삭제 → DB 행 삭제** 순서다. mock 호출 순서를 assert하라
17. Storage 삭제가 실패하면 **DB 행을 지우지 않는다** (지우면 객체가 영원히 고아가 된다)
18. `storage_path`가 `null`인(90일 만료된) 업로드는 Storage 단계를 건너뛰고 DB만 지운다
19. DB 행 삭제로 `transactions`가 cascade된다 (마이그레이션이 보장 — 여기서는 별도 삭제를 하지 않음을 assert)
20. 성공 시 204 또는 200
21. 삭제도 `userId` 스코프 헬퍼를 통한다

### 로깅
22. 파일명·가맹점명이 로그에 없다

## Codex 실행 지시문

### 타인의 것은 404

```ts
const upload = await getUploadForUser(userId, id);   // userId 스코프가 걸린 헬퍼
if (!upload) return Response.json({ error: 'not_found' }, { status: 404 });
```

`userId` 스코프 헬퍼를 쓰면 "없음"과 "남의 것"이 자연스럽게 같은 결과가 된다. **두 경우를 구분해 다른 상태 코드를 주지 마라** — 403은 그 id의 존재를 알려준다.

`not_found`는 고정 어휘 7개에 없다. HTTP 404 자체가 신호이므로 본문의 `error` 필드는 생략하거나 고정 문자열 하나를 쓴다. **어휘 7개를 늘리지 마라.**

### `free`면 거래를 읽지도 마라

```ts
const scope = viewScope(plan);
const txns = scope.canViewTransactions ? await fetchTxns(userId, id) : [];
const lockedCount = scope.canViewTransactions ? 0 : upload.row_count ?? 0;
```

읽어서 `gateReport`에 넘기고 버리는 것도 동작은 맞지만, **안 읽는 편이 낫다** — DB 부하가 줄고, 나중에 누가 응답에 디버그 필드를 추가할 때 실수로 실려 나갈 여지가 사라진다.

`lockedTxnCount`는 `uploads.row_count`에서 온다. 거래를 세려고 조회하지 마라.

### `plan`은 서버가 읽는다

```ts
const plan = await getProfilePlan(userId);    // ✅
// const plan = searchParams.get('plan');     // ❌ 클라이언트가 보낸 구독 상태는 신뢰하지 않는다
```

ADR-019·ADR-020. 요청의 어떤 부분도 권한 근거가 될 수 없다.

### 폴링 응답은 가볍게

`status: 'processing'`이면 거래도 summary도 조회하지 마라. 브라우저가 2초 간격으로 부른다.

**진행률을 만들어 반환하지 마라.** 상태는 `processing | completed | failed` 3개뿐이고, 퍼센트는 근거가 없다(DESIGN.md §7).

### DELETE 순서

```ts
// ARCHITECTURE.md §삭제 정합성: "Storage 객체 → DB 행 순서로 두 단계를 명시적으로 수행한다"
if (upload.storage_path) {
  await deleteOriginalForUser(userId, upload.storage_path);   // 실패하면 여기서 중단
}
await deleteUploadRow(userId, id);   // transactions 는 on delete cascade
```

Storage 삭제 실패 시 **DB 행을 지우지 마라.** 지우면 그 객체를 가리키는 것이 세상에 없어져 만료 잡의 대상에서도 빠진다. 500을 반환하고 사용자가 다시 시도하게 하라.

`transactions`를 명시적으로 지우지 마라 — `on delete cascade`가 처리한다. 두 곳에서 지우면 한쪽이 바뀔 때 갈라진다.

## 완료 조건

- `GET`·`DELETE`가 있고 22개 테스트가 전부 통과한다
- 타인·부재 모두 404이고 응답이 구분되지 않는다
- free 응답 JSON에 가맹점명이 없다
- `plan`을 서버가 읽는다
- DELETE가 Storage → DB 순서이고 Storage 실패 시 DB를 안 건드린다
- 만료된 업로드도 리포트가 나온다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run "src/app/api/uploads/[id]/route.test.ts"
```

직접 확인:

```bash
grep -nE "403|searchParams.get\('plan'\)|req.*plan" "src/app/api/uploads/[id]/route.ts" && echo "확인 필요" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §RLS — 타인 접근이 404인가?
   - §게이트는 서버가 자른다 — 잠긴 데이터를 직렬화하지 않는가? `plan`을 서버가 읽는가?
   - §삭제 정합성 — Storage → DB 순서인가? `transactions`를 중복 삭제하지 않는가?
   - ADR-005 — 만료된 업로드의 리포트가 남는가?
   - AGENTS.md CRITICAL — 에러가 고정 어휘인가? 로그에 PII 없는가?
3. 결과에 따라 `phases/2-api/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/api/uploads/[id]/route.ts — GET: userId 스코프 조회(부재/타인 모두 404), plan은 서버가 DB에서, free면 거래를 아예 조회하지 않고 lockedTxnCount는 row_count에서, processing이면 상태만. DELETE: Storage→DB 순서, Storage 실패 시 DB 미삭제, transactions는 cascade")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(2-api): step 3 — uploads-detail`

포함: `src/app/api/uploads/[id]/route.{ts,test.ts}`

## 금지사항

- **타인의 업로드에 403을 반환하지 마라.** 이유: 403은 그 id가 존재한다는 것을 알려준다. 404여야 한다.
- **`free` 응답에 거래 행을 실어 보내지 마라 — 미리보기도 안 된다.** 이유: 잠긴 데이터를 보내고 가리는 것은 게이트가 아니다(ADR-019).
- **요청에서 `plan`을 읽지 마라.** 이유: 클라이언트가 보낸 구독 상태를 신뢰하면 누구나 Pro가 된다(ADR-020).
- **DB 행만 지우고 Storage 객체를 남기지 마라.** 이유: 주인 없는 객체가 만료 잡 대상에서도 빠진다.
- **Storage 삭제 실패 후에도 DB 행을 지우지 마라.** 이유: 그 객체를 가리키는 것이 세상에서 사라진다.
- **`transactions`를 명시적으로 지우지 마라.** 이유: `on delete cascade`가 한다. 두 곳에서 지우면 갈라진다.
- **만료된 업로드의 `transactions`·`summary`를 지우지 마라.** 이유: 사라지는 것은 원본 파일뿐이다(ADR-005).
- **진행률 퍼센트를 반환하지 마라.** 이유: 상태는 3개뿐이고 퍼센트는 근거가 없다.
- **에러 어휘를 7개보다 늘리지 마라.**
- **`/api/uploads/:id/status` 같은 별도 폴링 라우트를 만들지 마라.** 이유: 이 GET이 폴링 대상이다. 라우트를 늘리지 않는다.
- 기존 테스트를 깨뜨리지 마라.
