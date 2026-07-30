# Step 4: supabase-clients

## 목적

Supabase 클라이언트 3종을 만든다. 각각 **다른 방어선** 위에 있고, 그 차이가 코드로 드러나야 한다.

| 파일 | 누가 쓰나 | 방어선 |
|---|---|---|
| `lib/supabase/client.ts` | 클라이언트 컴포넌트 | anon 키 + RLS |
| `lib/supabase/server.ts` | 서버 컴포넌트 · 사용자 요청 라우트 | 세션 쿠키 + RLS |
| `lib/supabase/service.ts` | `after()` 워커 · 전역 사전 갱신 · 웹훅 | RLS 우회 → **헬퍼가 `userId`를 필수 첫 인자로 받는다** |

세 번째가 이 step의 핵심이다. **service role은 RLS를 우회하므로 "실수로 남의 행을 건드리는 것"을 규율이 아니라 타입으로 막아야 한다**(AGENTS.md CRITICAL).

## 이전 Step과의 의존성

- **step 0 (`project-setup`)** — `@supabase/supabase-js`·`@supabase/ssr`가 설치되어 있고, `.env.example`에 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`·`SUPABASE_SERVICE_ROLE_KEY` 이름이 있다
- **step 2 (`core-types`)** — `UploadRow`·`ClassifiedTxn` 등 반환 타입
- **step 3 (`db-schema`)** — 테이블·컬럼 이름. **DB에 적용되어 있지 않아도 된다** — 이 step의 테스트는 SDK를 전부 mock한다

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §Supabase 키 사용 규칙 표 · §RLS 경계 · §Storage
- `/docs/ADR.md` — ADR-016(Supabase 단일 백엔드) · ADR-018(mock-first) · ADR-017(`after()` 안에서 요청 컨텍스트가 사라진다)
- `/AGENTS.md` — 「아키텍처 규칙」의 service role CRITICAL 두 항목
- `/supabase/migrations/0001_schema.sql` — 테이블·컬럼 이름
- `/src/types/**` — step 2 산출물
- `/phases/PLAN.md` — 공통 규칙 4·5(mock-first · lazy env)

## 구현 범위

클라이언트 팩토리 3개 + service role 헬퍼들. **비즈니스 로직은 넣지 않는다** — 분석 파이프라인·집계·게이트는 전부 이후 Phase다.

`service.ts`에 두는 헬퍼는 이후 step들이 실제로 필요로 하는 것만:

```
getUploadForUser(userId, uploadId)
updateUploadForUser(userId, uploadId, patch)
insertTransactionsForUser(userId, uploadId, rows)
downloadOriginalForUser(userId, storagePath)
deleteOriginalForUser(userId, storagePath)
getProfilePlan(userId)
```

전역 사전(`merchant_dictionary`)과 포맷 매핑(`csv_format_mappings`)의 **읽기/쓰기 헬퍼는 여기 두지 않는다.** 사용자 소유가 아니고, 쓰기 경로를 `lib/classify/dictionary.ts` 하나로 제한하기로 했다(ARCHITECTURE.md §Supabase 키 사용 규칙). 그건 Phase 1 step 4다. 대신 그 파일이 쓸 **raw service client 팩토리**(`createServiceClient()`)는 export한다.

## 수정 대상 파일

```
src/lib/supabase/client.ts        (신규)
src/lib/supabase/client.test.ts   (신규 — 먼저)
src/lib/supabase/server.ts        (신규)
src/lib/supabase/server.test.ts   (신규 — 먼저)
src/lib/supabase/service.ts       (신규)
src/lib/supabase/service.test.ts  (신규 — 먼저)
```

## 먼저 작성할 테스트

`vi.mock('@supabase/supabase-js')`와 `vi.mock('@supabase/ssr')`로 SDK를 전부 갈아끼운다. **실제 네트워크·실제 키가 필요하면 안 된다**(ADR-018).

### `client.test.ts`
1. `createBrowserClient`가 `NEXT_PUBLIC_` 환경변수 2개로 호출된다
2. **소스에 `SUPABASE_SERVICE_ROLE_KEY` 문자열이 없다** — 파일을 읽어서 검사하라. 이유: 클라이언트 번들에 service role 키가 섞이는 사고를 테스트로 못박는다
3. 환경변수가 없는 상태에서 **모듈 import는 성공하고**, 팩토리를 호출할 때 비로소 throw한다 (lazy)

### `server.test.ts`
1. `createServerClient`에 쿠키 read/write 어댑터가 전달된다
2. anon 키를 쓴다 (service role이 아니다)
3. lazy env — import 시점에 throw하지 않는다

### `service.test.ts` ← 이 step의 중심
1. **모든 헬퍼의 첫 인자가 `userId`다.** 함수의 `.length`와 소스 시그니처를 검사한다
2. `getUploadForUser(userId, uploadId)`가 쿼리에 `user_id = userId` 필터를 **반드시** 건다. mock 체인에서 `.eq('user_id', userId)` 호출을 assert하라
3. `updateUploadForUser` · `insertTransactionsForUser` · `deleteOriginalForUser`도 마찬가지로 `userId` 스코프가 걸린다
4. `insertTransactionsForUser`가 넣는 각 행에 `user_id`가 채워진다 (`transactions.user_id`는 RLS 대상 컬럼이다)
5. `downloadOriginalForUser`/`deleteOriginalForUser`가 `storagePath`가 `${userId}/`로 시작하지 않으면 **호출 전에 throw**한다. 이유: `{user_id}/` 접두사가 Storage 정책의 전제조건이고, 여기가 유일한 경로 조립 지점이다
6. lazy env — import 시점에 throw하지 않고 팩토리 호출 시 throw한다
7. `createServiceClient()`가 `auth: { persistSession: false, autoRefreshToken: false }`로 만들어진다 (서버 워커에 세션이 붙으면 안 된다)

## Codex 실행 지시문

### 시그니처

```ts
// client.ts — 브라우저 전용
export function createClient(): SupabaseClient;

// server.ts — 서버 컴포넌트 · 사용자 요청 라우트
export async function createClient(): Promise<SupabaseClient>;   // next/headers 의 cookies() 는 async
export async function getUser(): Promise<User | null>;

// service.ts — RLS 우회. userId 가 필수 첫 인자다.
export function createServiceClient(): SupabaseClient;

export async function getProfilePlan(userId: string): Promise<'free' | 'pro'>;
export async function getUploadForUser(userId: string, uploadId: string): Promise<UploadRow | null>;
export async function updateUploadForUser(userId: string, uploadId: string, patch: Partial<UploadRow>): Promise<void>;
export async function insertTransactionsForUser(userId: string, uploadId: string, rows: ClassifiedTxn[]): Promise<void>;
export async function downloadOriginalForUser(userId: string, storagePath: string): Promise<Uint8Array>;
export async function deleteOriginalForUser(userId: string, storagePath: string): Promise<void>;
```

`userId`를 **선택 인자나 마지막 인자로 두지 마라.** 첫 인자 필수여야 호출부가 빼먹을 수 없다.

`userId`를 받고도 쿼리에 안 거는 헬퍼를 만들지 마라 — 그러면 시그니처가 거짓말이 된다.

### lazy env

```ts
// 이렇게 하지 마라 — next build 의 프리렌더가 깨진다
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;   // ❌ 모듈 최상단

// 이렇게 하라
function requireEnv(name: string): string {          // ✅ 호출 시점에 읽는다
  const v = process.env[name];
  if (!v) throw new Error(`missing env: ${name}`);   // 값은 절대 로그에 남기지 마라
  return v;
}
```

에러 메시지에 **환경변수 값을 넣지 마라.** 이름만 남긴다.

### Storage 경로 조립

```ts
export function storagePathFor(userId: string, uploadId: string): string;  // `${userId}/${uploadId}.csv`
```

`downloadOriginalForUser`/`deleteOriginalForUser`는 넘어온 경로가 `${userId}/`로 시작하는지 **검증하고 아니면 throw**한다. 이 검증이 실패한다는 건 호출부에 버그가 있다는 뜻이지 사용자 입력 문제가 아니므로, 클라이언트 에러 어휘로 감싸지 말고 그냥 던져라.

### 로깅

이 파일들에서 **아무것도 로그로 남기지 마라.** 특히 쿼리 결과·`storagePath`·이메일. PII 로깅 금지는 AGENTS.md CRITICAL이다.

## 완료 조건

- 파일 3개 + 테스트 3개가 존재한다
- `service.ts`의 모든 export된 데이터 접근 헬퍼가 `userId`를 첫 인자로 받는다
- `client.ts` 소스에 `SUPABASE_SERVICE_ROLE_KEY`가 등장하지 않는다
- 세 파일 모두 모듈 최상단에서 `process.env`를 읽지 않는다
- 테스트가 실제 키·네트워크 없이 통과한다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/supabase
```

직접 확인:

```bash
grep -n "SERVICE_ROLE" src/lib/supabase/client.ts && echo "FAIL" || echo "OK"
# 모듈 최상단 env 읽기 탐지 (함수 밖 const 할당)
grep -nE "^const .*process\.env" src/lib/supabase/*.ts && echo "FAIL: eager env" || echo "OK: lazy env"
```

키 없이 빌드되는지:

```bash
env -u NEXT_PUBLIC_SUPABASE_URL -u SUPABASE_SERVICE_ROLE_KEY npm run build
```
(Windows PowerShell이면 `.env`를 잠시 옮기고 `npm run build`)

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `lib/supabase/{client,server,service}.ts` 3개인가?
   - §Supabase 키 사용 규칙 표의 4행이 각각 어느 파일로 처리되는지 코드에서 읽히는가?
   - AGENTS.md CRITICAL — service role 헬퍼가 `userId` 필수 첫 인자인가? 클라이언트로 service role이 새지 않는가?
   - AGENTS.md CRITICAL — 환경변수 검증이 lazy인가?
   - 테스트가 외부 키를 요구하지 않는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/supabase/{client,server,service}.ts. service 헬퍼 6개 전부 userId 필수 첫 인자 + user_id 필터 강제, storagePathFor()가 {userId}/{uploadId}.csv 조립·접두사 검증. lazy env. SDK 전부 mock")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(0-foundation): step 4 — supabase-clients`

포함: `src/lib/supabase/**`

## 금지사항

- **service role 헬퍼의 `userId`를 선택 인자로 만들지 마라.** 이유: 빼먹을 수 있는 인자는 언젠가 빠지고, RLS를 우회한 상태에서 빠지면 남의 데이터를 건드린다. 규율이 아니라 타입으로 막는다(AGENTS.md CRITICAL).
- **`client.ts`에서 service role 키를 참조하지 마라.** 이유: 클라이언트 번들에 들어간다.
- **모듈 최상단에서 `process.env`를 읽고 throw하지 마라.** 이유: `next build`가 페이지를 프리렌더하므로 빌드가 깨진다(ADR-018).
- **전역 사전(`merchant_dictionary`)·포맷 매핑 헬퍼를 여기 만들지 마라.** 이유: 쓰기 경로를 `lib/classify/dictionary.ts` 하나로 제한하기로 했다(ARCHITECTURE.md). 여기에도 만들면 경로가 둘이 된다.
- **평평한 Storage 경로를 만들지 마라.** 이유: 표준 정책이 경로 첫 세그먼트를 소유자로 본다.
- **아무것도 로그로 남기지 마라.** 이유: 이 층을 지나는 데이터가 전부 PII다.
- **재시도·백오프·연결 풀 같은 "유연성"을 넣지 마라.** 이유: 요청되지 않았고, 실패는 상위 파이프라인이 `error_code`로 처리한다.
- **비즈니스 로직(집계·분류·게이트)을 넣지 마라** — 각각 Phase 1·2 소관이다.
- 기존 테스트를 깨뜨리지 마라.
