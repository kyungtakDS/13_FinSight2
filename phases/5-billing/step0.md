# Step 0: polar-client

## 목적

Polar SDK를 감싸는 클라이언트를 만든다. Claude 클라이언트(Phase 1 step 2)와 같은 역할이다 — **lazy 환경변수 · 외부 SDK 격리 · mock 가능한 경계**.

Polar에 위임한 것이 많다는 걸 기억하라(ADR-007): 결제수단·영수증·취소 UI를 만들지 않는다. **구독 테이블도 두지 않는다**(ADR-021). 앱이 묻는 질문은 "이 사용자가 Pro인가" 하나뿐이고 답은 `profiles.plan`이다.

## 이전 Step과의 의존성

Phase 0~4 전체가 `completed`여야 한다. 직접 쓰는 것:

- **Phase 0 step 0** — `@polar-sh/sdk@0.49.0`·`@polar-sh/nextjs@0.9.6`이 설치되어 있고 `.env.example`에 `POLAR_ACCESS_TOKEN`·`POLAR_PRODUCT_ID`·`POLAR_WEBHOOK_SECRET`·`NEXT_PUBLIC_SITE_URL`이 있다
- **Phase 1 step 2 (`claude-client`)** — lazy env 패턴의 선례. 같은 형태로 만들어라

`.env.example`에 **`POLAR_SERVER`가 빠져 있다** — 이 step이 추가한다(D-18).
그리고 `NEXT_PUBLIC_APP_URL`은 코드에서 **한 곳도 참조하지 않는 죽은 키다** — 삭제한다(D-19).

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§Polar 결제 전문**
- `/docs/ADR.md` — ADR-007(Portal 위임) · ADR-020(권한의 source of truth) · ADR-021(구독 테이블 없음) · ADR-018(mock-first) · **ADR-023(SDK 헬퍼 미사용)**
- `/phases/PLAN.md` — **D-15 · D-18 · D-19**
- `/docs/PRD.md` — §구독 및 기능 게이트 · UC-07 · UC-13 · UC-14
- `/src/services/claude/client.ts` — lazy env 패턴 참조
- `/AGENTS.md` — CRITICAL 항목
- `node_modules/@polar-sh/sdk/**` 의 타입 정의 — **API 이름을 여기서 확인하라. 추측하지 마라**

## 구현 범위

`src/services/polar/client.ts` 하나 + `.env.example` 정리.

```ts
export function getPolar(): Polar;                  // lazy. 호출 시점에 env 검증
export function getProductId(): string;             // POLAR_PRODUCT_ID. 하나만 허용한다
export function getWebhookSecret(): string;
export function getSiteUrl(): string;               // return URL 구성에 쓴다. 요청 헤더를 신뢰하지 않는다
export function getPolarServer(): 'sandbox' | 'production';   // D-18

export class PolarError extends Error {
  readonly kind: 'config' | 'upstream';
}
```

**checkout 생성·portal 링크·웹훅 처리는 여기 없다** — 각각 step 2·3이다. 이 파일은 SDK 인스턴스와 설정 값을 lazy하게 내주는 것까지다.

## 수정 대상 파일

```
src/services/polar/client.ts        (신규)
src/services/polar/client.test.ts   (신규 — 먼저)
.env.example                        (수정 — POLAR_SERVER 추가, NEXT_PUBLIC_APP_URL 삭제)
```

## 먼저 작성할 테스트

`vi.mock('@polar-sh/sdk')`로 SDK를 갈아끼운다. **실제 토큰·네트워크가 필요하면 안 된다**(ADR-018).

### lazy env
1. 환경변수가 하나도 없어도 **모듈 import가 성공한다**
2. `getPolar()` 호출 시에 비로소 throw한다 (`kind: 'config'`)
3. `getProductId()`·`getWebhookSecret()`·`getSiteUrl()`도 각각 호출 시점에 검증한다
4. **throw된 에러 메시지에 토큰·시크릿 값이 들어 있지 않다** — 이름만
5. `next build`가 이 모듈을 import하는 페이지를 프리렌더해도 안 깨진다 (모듈 최상단 `process.env` 읽기 부재를 소스 검사로 확인)

### 설정
6. `getPolar()`가 `POLAR_ACCESS_TOKEN`으로 SDK를 만든다
7. `getSiteUrl()`이 `NEXT_PUBLIC_SITE_URL`을 쓰고, 끝의 슬래시를 정규화한다
8. 인스턴스가 캐시된다 (호출마다 새로 만들지 않는다)

### `POLAR_SERVER` ← D-18
9. `POLAR_SERVER === 'sandbox'` → SDK가 샌드박스로 만들어진다
10. `POLAR_SERVER === 'production'` → 프로덕션
11. **`POLAR_SERVER`가 없으면 `PolarError(kind: 'config')`를 던진다.** production으로 기본값을 두지 마라
12. **`'sandbox'`·`'production'` 외의 값은 거절한다** (`'prod'`·`'SANDBOX'`·빈 문자열 전부)
13. 던진 에러 메시지에 **허용되는 두 값은 적어도 되지만 토큰 값은 안 된다**

### 격리
14. `console.*` 호출 0회 — 웹훅 body와 고객 정보가 이 층을 지난다
15. 이 파일이 **Supabase를 import하지 않는다** — DB 갱신은 웹훅 핸들러의 일이다
16. **이 파일이 `@polar-sh/nextjs`를 import하지 않는다** ← D-15

### `.env.example`
17. `POLAR_SERVER` 항목이 있다
18. `NEXT_PUBLIC_APP_URL` 항목이 **없다** (D-19)

## Codex 실행 지시문

### API 이름을 추측하지 마라

`@polar-sh/sdk`의 클래스명·메서드명·옵션명은 버전에 따라 다르다. **설치된 패키지의 타입 정의를 열어 확인하고 그 이름을 써라.**

확인할 것:
- SDK 생성자와 `accessToken` 옵션 이름
- 샌드박스 서버를 고르는 옵션 (`server: 'sandbox' | 'production'` 형태인지 별도 baseURL인지)
- `@polar-sh/sdk/webhooks`의 `validateEvent`·`WebhookVerificationError` (step 3이 쓴다 — `summary`에 남겨라)

못 찾으면 그 사실을 `error_message`에 적고 실패시켜라. 추측한 옵션은 에러 없이 무시되고 프로덕션 결제에 붙는 날 문제가 된다.

### `@polar-sh/nextjs`의 헬퍼를 조사하지도, 쓰지도 마라 ← D-15 · ADR-023

**이미 조사했고 쓰지 않기로 결정됐다.** 다시 열어 "쓸 만해 보인다"고 판단하지 마라.

- `Checkout` (`dist/index.js:18-45`) — `products`·`customerId`·`customerExternalId`·`customerEmail`·`discountId`·`metadata` 등 **11개를 쿼리 파라미터에서 읽는다.** ARCHITECTURE.md §Polar 결제의 "요청의 product ID·user ID·return URL을 신뢰하지 않는다"를 정면으로 위반한다
- `CustomerPortal`·`Checkout`·`Webhooks` (`dist/index.js:54`·`:89`·`:107`) — `console.error(error)`로 SDK 원본 에러를 그대로 찍는다. AGENTS.md CRITICAL(로그 PII 금지) 위반
- `Webhooks` — raw body 검증 자체는 올바르지만 검증 실패에 **403**을 강제하고 성공 응답을 통제할 수 없다(D-14)

**`@polar-sh/sdk`만 쓴다.** 서명 검증은 `@polar-sh/sdk/webhooks`의 `validateEvent`를 step 3이 직접 부른다.

### `POLAR_SERVER`는 기본값을 갖지 않는다 ← D-18

```ts
export function getPolarServer(): 'sandbox' | 'production' {
  const v = requireEnv('POLAR_SERVER');
  if (v !== 'sandbox' && v !== 'production') {
    throw new PolarError("POLAR_SERVER must be 'sandbox' or 'production'", 'config');
  }
  return v;
}
```

**`?? 'production'`을 쓰지 마라.** 환경변수를 깜빡한 로컬·CI가 실 결제 서버에 붙는다.
반대로 `?? 'sandbox'`도 쓰지 마라 — 프로덕션 배포에서 깜빡하면 결제가 조용히 샌드박스로 가고, **돈이 안 들어오는데 사용자는 Pro가 된다.** 어느 쪽 기본값도 안전하지 않으므로 던진다.

### lazy env — Claude 클라이언트와 같은 형태

```ts
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new PolarError(`missing env: ${name}`, 'config');   // 값은 절대 로그·메시지에 넣지 마라
  return v;
}
```

모듈 최상단에서 `process.env`를 읽지 마라 — `next build`의 프리렌더가 깨진다(ADR-018).

### `POLAR_PRODUCT_ID`는 하나다

ARCHITECTURE.md §Polar 결제: *"checkout은 서버가 `POLAR_PRODUCT_ID` 하나만 허용하고…"*

`getProductId()`가 배열이나 목록을 반환하게 만들지 마라. 다단계 요금제는 명시적으로 제외됐다(PRD MVP 제외 사항).

### `getSiteUrl()`이 있는 이유

ARCHITECTURE.md: *"return URL은 **서버가 구성**하며 `/dashboard?checkout=1`이다."*

요청 헤더(`Host`·`Origin`·`Referer`)에서 origin을 만들면 헤더 스푸핑으로 리다이렉트를 유도할 수 있다. **환경변수 하나에서 온다.**

### `console.*` 금지

이 층을 웹훅 body와 고객 식별자가 지난다. ARCHITECTURE.md: *"로그에도 … 웹훅 원문 body를 남기지 않는다."*

### Supabase를 import하지 마라

`plan` 갱신은 웹훅 핸들러(step 3)가 한다. 이 파일이 DB를 알면 두 관심사가 섞인다.

### 구독 상태를 미러링하지 마라

ADR-021: *"별도 `subscriptions` 테이블을 만들지 않는다."* 여기에 구독 조회 헬퍼(`getSubscription`·`listInvoices`)를 만들지 마라 — 앱에 그걸 보여줄 화면이 없다. 필요해지면 그때 만든다.

## 완료 조건

- `getPolar`·`getProductId`·`getWebhookSecret`·`getSiteUrl`·`getPolarServer`·`PolarError`가 존재한다
- 18개 테스트가 실제 토큰 없이 전부 통과한다
- 모듈 최상단에서 `process.env`를 읽지 않는다
- 에러 메시지에 시크릿 값이 없다
- `POLAR_SERVER`가 두 값만 받고 기본값이 없다 (D-18)
- `console.*` 호출 0회
- Supabase를 import하지 않는다
- **`@polar-sh/nextjs`를 import하지 않는다** (D-15)
- `.env.example`에 `POLAR_SERVER`가 있고 `NEXT_PUBLIC_APP_URL`이 없다 (D-19)
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/services/polar/client.test.ts
```

직접 확인:

```bash
grep -nE "^const .*process\.env" src/services/polar/client.ts && echo "FAIL: eager env" || echo "OK"
grep -n "console\." src/services/polar/client.ts && echo "FAIL" || echo "OK"
grep -n "supabase" src/services/polar/client.ts && echo "FAIL: 관심사 혼합" || echo "OK"
grep -n "@polar-sh/nextjs" src/services/polar/client.ts && echo "FAIL: D-15 위반" || echo "OK"
grep -nE "POLAR_SERVER.*\?\?|POLAR_SERVER.*\|\|" src/services/polar/client.ts && echo "FAIL: 기본값 금지(D-18)" || echo "OK"

grep -q "^POLAR_SERVER=" .env.example && echo "OK" || echo "FAIL: POLAR_SERVER 누락"
grep -q "NEXT_PUBLIC_APP_URL" .env.example && echo "FAIL: D-19 미반영" || echo "OK"
```

토큰 없이 빌드되는지:

```bash
env -u POLAR_ACCESS_TOKEN -u POLAR_PRODUCT_ID -u POLAR_WEBHOOK_SECRET -u POLAR_SERVER npm run build
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `services/polar/client.ts`인가?
   - §Polar 결제 — product ID 하나만, return URL은 서버 구성인가?
   - ADR-018 — lazy env이고 테스트가 토큰을 요구하지 않는가?
   - ADR-021 — 구독 미러링 헬퍼를 안 만들었는가?
   - ADR-023 / D-15 — `@polar-sh/nextjs`를 import하지 않았는가?
   - AGENTS.md CRITICAL — 로그에 PII 없는가? 외부 SDK가 `src/services/` 뒤에 격리됐는가?
3. 결과에 따라 `phases/5-billing/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "services/polar/client.ts — getPolar()/getProductId()/getWebhookSecret()/getSiteUrl()/getPolarServer() 전부 lazy env, 인스턴스 캐시. POLAR_SERVER 는 sandbox|production 만·기본값 없음. PolarError(kind: config|upstream). SDK 실제 API 이름: <확인한 이름들>. webhooks 서명 검증 export: <validateEvent 등 실제 이름>. @polar-sh/nextjs 미사용. .env.example 에 POLAR_SERVER 추가·NEXT_PUBLIC_APP_URL 삭제")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. `summary`에 **SDK에서 확인한 실제 API 이름들**과 **`@polar-sh/sdk/webhooks`의 서명 검증 export 이름**을 남겨라 — step 2·3이 그걸 읽는다.

## commit 기준

`feat(5-billing): step 0 — polar-client`

포함: `src/services/polar/client.{ts,test.ts}` · `.env.example`

## 금지사항

- **SDK API 이름을 추측하지 마라.** 이유: 틀린 옵션은 에러 없이 무시되고 프로덕션 결제에 붙는 날 문제가 된다. 타입 정의를 열어 확인하라.
- **`@polar-sh/nextjs`를 import하지 마라.** 이유: `Checkout`이 쿼리 파라미터 11개를 신뢰하고 세 곳에서 `console.error`로 원본 에러를 찍는다(D-15 · ADR-023).
- **`POLAR_SERVER`에 기본값을 주지 마라.** 이유: `'production'` 기본은 로컬이 실 결제에 붙고, `'sandbox'` 기본은 프로덕션에서 돈이 안 들어오는데 사용자가 Pro가 된다. 어느 쪽도 안전하지 않다(D-18).
- **`.env`를 커밋하지 마라.** 고치는 것은 `.env.example`뿐이다.
- **모듈 최상단에서 `process.env`를 읽고 throw하지 마라.** 이유: `next build`의 프리렌더가 깨진다(ADR-018).
- **에러 메시지·로그에 토큰·시크릿·웹훅 body를 넣지 마라.**
- **`getProductId()`가 목록을 반환하게 만들지 마라.** 이유: 단일 상품이고 다단계 요금제는 MVP 제외다.
- **return URL을 요청 헤더에서 만들지 마라.** 이유: 헤더 스푸핑으로 리다이렉트를 유도할 수 있다. 환경변수에서 온다.
- **구독 조회·청구 이력 헬퍼를 만들지 마라.** 이유: 보여줄 화면이 없다. Polar Customer Portal에 위임했다(ADR-007·ADR-021).
- **이 파일에서 Supabase를 import하지 마라.** 이유: `plan` 갱신은 웹훅 핸들러의 일이고, 섞이면 두 관심사가 한 파일에 산다.
- **checkout 생성·웹훅 검증 로직을 여기 넣지 마라** — step 2·3이다.
- **클라이언트 컴포넌트에서 import 가능한 형태로 만들지 마라.** 이유: AGENTS.md CRITICAL.
- 기존 테스트를 깨뜨리지 마라.
