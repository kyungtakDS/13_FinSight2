# Step 2: uploads-ingest

## 목적

`POST /api/uploads` — 파일을 접수하고 **202 + id를 즉시 반환한 뒤** `after()`로 분석을 잇는다.
`GET /api/uploads` — 과거 업로드 목록.

접수 순서가 이 step의 전부다(ARCHITECTURE.md §접수 순서와 보상):

```
파일 → 크기·확장자 검사 → 파일 해시 → 동일 해시 존재? ─ 예 → 409 duplicate_file  [Storage 미사용]
                                                     └ 아니오 ↓
     Storage 업로드 → uploads 행 INSERT → 202 + id
                          └ 실패 → 방금 올린 객체 best-effort 삭제 (보상)
```

**해시 중복 검사는 Storage 업로드 *전*이다.** 이미 가진 파일을 다시 올리게 두고 나서 거절하면 대역폭과 저장 비용을 태운다.

## 이전 Step과의 의존성

- **step 1 (`analysis-pipeline`)** — `runAnalysis(userId, uploadId)`
- **Phase 1 step 1 (`csv-fingerprint`)** — `fileHash`
- **Phase 0 step 4 (`supabase-clients`)** — `server.ts`의 `createClient`/`getUser`, `service.ts`의 `storagePathFor`
- **Phase 0 step 5 (`auth-flow`)** — 미들웨어가 인증을 보장하지만 **라우트도 스스로 확인한다**

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§접수 순서와 보상** · §분석은 비동기 잡이다 · §디렉토리 구조 · §Storage · §오류 처리
- `/docs/ADR.md` — ADR-005(90일) · ADR-010(CSV only) · ADR-014(파일 해시 중복) · ADR-017(`after()`+`maxDuration`)
- `/docs/PRD.md` — §제약(2MB / 3,000행) · UC-04 · UC-05
- `/src/lib/analysis/run-analysis.ts` · `/src/lib/csv/fingerprint.ts` · `/src/lib/supabase/**`
- `/supabase/migrations/0001_schema.sql` — `uploads` 컬럼과 유니크 인덱스

## 구현 범위

```
src/app/api/uploads/route.ts    — POST(접수) + GET(목록)
```

```ts
export const runtime = 'nodejs';        // Edge 아님
export const maxDuration = 300;         // 최악 분석 시간(60–180초)을 덮는다

export async function POST(req: Request): Promise<Response>;   // 202 { id } | 4xx { error }
export async function GET(req: Request): Promise<Response>;    // 200 { uploads: [...] }
```

## 수정 대상 파일

```
src/app/api/uploads/route.ts        (신규)
src/app/api/uploads/route.test.ts   (신규 — 먼저. route.ts 와 같은 디렉토리)
```

## 먼저 작성할 테스트

`vi.mock`으로 `@/lib/supabase/server`·`@/lib/supabase/service`·`@/lib/analysis/run-analysis`·`next/server`의 `after`를 갈아끼운다.

### 인증
1. 세션이 없으면 401. **미들웨어를 믿고 생략하지 마라** — API는 직접 호출될 수 있다

### 입력 검증 (Storage에 손대기 전)
2. `multipart/form-data`가 아니면 400 `parse_failed`
3. 확장자가 `.csv`가 아니면 400 `parse_failed` (XLSX·PDF도 여기)
4. 2MB를 넘으면 400 `too_large`
5. 빈 파일이면 400 `parse_failed`
6. **위 검증들이 전부 Storage 업로드 전에 일어난다** — 실패 케이스에서 Storage mock이 호출되지 않음을 assert하라

### 중복 검사 ← 순서가 핵심
7. 같은 `file_hash` 행이 이미 있으면 **409** + `error: 'duplicate_file'` + **기존 `uploadId`를 함께 반환**한다 (PRD: "기존 분석으로 안내")
8. **409 경로에서 Storage가 호출되지 않는다** — 이 assert가 ARCHITECTURE.md §접수 순서의 전부다
9. 해시 검사가 `user_id` 스코프로 이뤄진다 (다른 사용자의 같은 파일은 중복이 아니다)

### 보상 ← 주인 없는 객체를 남기지 마라
10. Storage 업로드 성공 후 `uploads` INSERT가 실패하면 **방금 올린 객체를 삭제한다**
11. 그 삭제가 실패해도 응답은 500 하나다 (보상 실패를 사용자에게 노출하지 않는다)
12. **202는 Storage 객체와 `uploads` 행이 둘 다 준비된 뒤에만 나간다**

### `after()`
13. 202를 반환한 뒤 `after()`로 `runAnalysis(userId, uploadId)`가 예약된다
14. **`after()` 콜백을 `await`하지 않는다** — 응답이 분석을 기다리면 비동기 설계가 무의미하다
15. `runAnalysis`가 실패해도 이미 나간 202에 영향이 없다

### Storage 경로
16. `storage_path`가 `{user_id}/{upload_id}.csv`다
17. 사용자가 준 파일명이 경로에 들어가지 않는다 (경로 조작 방어 + 파일명은 PII다)

### `uploads` 행
18. `status: 'processing'` · `retry_count: 0` · `expires_at = created_at + 90일`
19. `filename`은 저장하되 **로그에는 안 남는다**

### GET 목록
20. 자기 업로드만 나온다
21. `created_at desc` 정렬
22. **목록에 `summary`의 전체 인사이트나 거래 행이 실리지 않는다** — 목록은 기간·거래 수·상태로 식별한다(PRD UC-10)
23. 페이지네이션 없이 상한(예: 100건)을 둔다

### 로깅
24. **파일명·CSV 내용이 로그에 없다**

## Codex 실행 지시문

### `maxDuration`을 반드시 선언하라

```ts
export const maxDuration = 300;
```

ARCHITECTURE.md: *"접수 라우트에 `export const maxDuration`을 선언하고 그 값이 최악의 분석 시간을 덮어야 한다."* 최악은 60–180초다. 여유를 두되 배포 플랜의 상한을 넘기지 마라 — 넘기면 배포가 거부된다.

`runtime`은 **Node.js**다. Edge에서는 `iconv-lite`·`crypto`가 안 돌고 `after()` 수명도 다르다.

### 검사 순서를 바꾸지 마라

```
1. 인증
2. content-type · 확장자 · 크기        ← 여기까지 Storage 미사용
3. 바이트 읽기 → fileHash
4. 해시 중복 조회                       ← 여기까지도 Storage 미사용
5. Storage 업로드
6. uploads INSERT  ─ 실패 → 5의 객체 삭제
7. 202 반환
8. after(() => runAnalysis(...))
```

3,000행 검사는 **여기서 하지 않는다.** 파싱해야 알 수 있고, 파싱은 `after()` 안의 파이프라인이 한다. 거기서 `too_large`로 실패시킨다(step 1의 테스트 8번).

### 409에 기존 `uploadId`를 실어라

```json
{ "error": "duplicate_file", "existingUploadId": "…" }
```

PRD: *"파일 내용 해시가 같으면 접수 단계에서 거절하고 **기존 분석으로 안내**한다."* ID가 없으면 화면이 안내를 못 한다.

### `after()`를 `await`하지 마라

```ts
import { after } from 'next/server';

const res = Response.json({ id }, { status: 202 });
after(() => runAnalysis(userId, uploadId));   // ❌ await after(...) 하지 마라
return res;
```

**브라우저는 분석의 주체가 아니다** — 탭을 닫아도 잡은 스스로 끝난다(ARCHITECTURE.md).

### 에러 응답은 고정 어휘만

```json
{ "error": "parse_failed" }
```

예외 메시지·SQL 에러·스택을 실어 보내지 마라. 어휘 7개 밖의 문자열을 쓰지 마라.

### 사용자 파일명을 경로에 넣지 마라

`storagePathFor(userId, uploadId)`가 만드는 `{userId}/{uploadId}.csv`만 쓴다. 파일명은 `uploads.filename` 컬럼에만 저장한다(화면 표시용). 경로에 넣으면 경로 조작이 가능해지고, 로그로도 새기 쉽다.

## 완료 조건

- `POST`·`GET`이 있고 `runtime: 'nodejs'`·`maxDuration`이 선언돼 있다
- 24개 테스트가 전부 통과한다
- **409 경로에서 Storage가 호출되지 않는다**
- INSERT 실패 시 Storage 보상 삭제가 일어난다
- `after()`를 `await`하지 않는다
- 에러 응답이 고정 어휘 7개뿐이다
- 로그에 파일명·CSV 내용이 없다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/app/api/uploads/route.test.ts
```

직접 확인:

```bash
grep -n "maxDuration\|runtime" src/app/api/uploads/route.ts
grep -n "await after" src/app/api/uploads/route.ts && echo "FAIL: after 를 await 함" || echo "OK"
```

수동 확인 (Supabase 적용 후 — **완료 조건 아님**):

```bash
npm run dev
# 브라우저 로그인 후 DevTools 에서:
#   fetch('/api/uploads', {method:'POST', body: fd}) → 202 {id}
#   같은 파일 다시 → 409 {error:'duplicate_file', existingUploadId}
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §접수 순서와 보상 — 해시 검사가 Storage 앞인가? 보상 삭제가 있는가? 202가 둘 다 준비된 뒤에만 나가는가?
   - §분석은 비동기 잡이다 — `maxDuration`·Node 런타임·`after()`가 맞는가?
   - §Storage — 경로가 `{user_id}/`로 시작하는가?
   - AGENTS.md CRITICAL — 외부 호출이 라우트 안에만 있는가? 에러가 고정 어휘인가? 로그에 PII 없는가?
3. 결과에 따라 `phases/2-api/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/api/uploads/route.ts — POST(runtime nodejs, maxDuration 300): 인증→확장자/2MB→fileHash→중복 409(+existingUploadId, Storage 미사용)→Storage {userId}/{id}.csv→INSERT(실패 시 객체 보상 삭제)→202 {id}→after(runAnalysis). GET: 자기 업로드 100건, created_at desc, 거래행/전체인사이트 미포함")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(2-api): step 2 — uploads-ingest`

포함: `src/app/api/uploads/route.{ts,test.ts}`

## 금지사항

- **Storage 업로드 후에 해시 중복을 검사하지 마라.** 이유: 이미 가진 파일을 다시 올리게 두고 거절하면 대역폭과 저장 비용을 태운다(ARCHITECTURE.md).
- **Storage 업로드 성공 + INSERT 실패를 그냥 두지 마라.** 이유: 주인 없는 객체가 버킷에 남고 만료 잡의 대상에서도 빠진다.
- **`after()`를 `await`하지 마라.** 이유: 응답이 분석을 기다리면 비동기 설계가 무의미해지고 요청 수명을 넘긴다.
- **큐·외부 워커를 도입하지 마라.** 이유: `after()` + `maxDuration`으로 충분하다고 결정했다(ADR-017).
- **`maxDuration`을 생략하지 마라.** 이유: 기본값이 최악 분석 시간(60–180초)보다 짧으면 분석이 중간에 죽는다.
- **Edge 런타임을 쓰지 마라.** 이유: `iconv-lite`·`crypto`가 안 돌고 `after()` 수명이 다르다.
- **사용자 파일명을 Storage 경로에 넣지 마라.** 이유: 경로 조작이 가능해지고 파일명은 PII다.
- **예외 메시지·SQL 에러를 응답에 실어 보내지 마라.** 이유: 고정 어휘 7개뿐이다.
- **3,000행 검사를 여기서 하지 마라.** 이유: 파싱해야 알 수 있고, 접수 라우트가 파싱하기 시작하면 202가 늦어진다.
- **분석 횟수를 세거나 제한하지 마라.** 이유: 횟수제는 폐기됐다(ADR-007).
- **XLSX·PDF 파서를 붙이지 마라.** 이유: MVP는 CSV only이고 명확한 거부가 정답이다(ADR-010).
- 기존 테스트를 깨뜨리지 마라.
