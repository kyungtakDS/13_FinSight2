# Step 1: billing-routes

## 목적

두 라우트를 만든다.

- `POST /api/billing/checkout` — Polar Checkout 세션을 만들어 리다이렉트
- `POST /api/billing/portal` — Polar Customer Portal 링크를 만들어 리다이렉트

한 문장이 이 step의 전부다(ARCHITECTURE.md §Polar 결제):

> **요청의 product ID·user ID·return URL을 신뢰하지 않는다.**

셋 다 서버가 정한다. 클라이언트가 보내는 것은 "결제하고 싶다"는 의사 표시뿐이다.

## 이전 Step과의 의존성

- **step 0 (`polar-client`)** — `getPolar`·`getProductId`·`getSiteUrl`. 그 step의 `summary`에 **SDK 실제 API 이름**이 있다
- **Phase 0 step 4 (`supabase-clients`)** — `server.ts`의 `getUser`, `service.ts`의 `getProfilePlan`·`profiles.polar_customer_id` 조회
- **Phase 0 step 5 (`auth-flow`)** — 미들웨어. 하지만 **라우트도 스스로 인증을 확인한다**

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§Polar 결제 전문**, 특히 처음 두 항목
- `/docs/ADR.md` — ADR-007(Portal 위임) · ADR-020(권한의 source of truth · `/dashboard?checkout=1`) · ADR-021
- `/docs/PRD.md` — UC-07 · UC-13
- `/src/services/polar/client.ts` — step 0 산출물
- `/phases/5-billing/index.json` — step 0의 `summary`
- `/supabase/migrations/0001_schema.sql` — `profiles.polar_customer_id`(customer ID의 단일 출처)

## 구현 범위

```
src/app/api/billing/checkout/route.ts   — POST
src/app/api/billing/portal/route.ts     — POST
```

```ts
export const runtime = 'nodejs';
export async function POST(req: Request): Promise<Response>;   // 303 리다이렉트 또는 { url }
```

## 수정 대상 파일

```
src/app/api/billing/checkout/route.ts        (신규)
src/app/api/billing/checkout/route.test.ts   (신규 — 먼저)
src/app/api/billing/portal/route.ts          (신규)
src/app/api/billing/portal/route.test.ts     (신규 — 먼저)
```

## 먼저 작성할 테스트

`vi.mock('@/services/polar/client')`와 Supabase 모듈을 갈아끼운다.

### checkout — 인증
1. 세션 없으면 401
2. 미들웨어를 믿고 생략하지 않는다 (라우트 단독 호출 테스트)

### checkout — 요청을 신뢰하지 않는다 ← 이 step의 핵심
3. **요청 본문의 `productId`를 무시한다.** `{ productId: '남의-상품' }`을 보내도 `getProductId()` 값이 쓰인다
4. **요청 본문의 `userId`/`customerId`를 무시한다.** `external_customer_id`가 **세션의 user.id**다
5. **요청 본문의 `returnUrl`/`successUrl`을 무시한다.** return URL이 `getSiteUrl() + '/dashboard?checkout=1'`이다
6. `?next=https://evil.com`을 붙여도 외부 URL이 안 나간다
7. **가격·금액을 요청에서 읽지 않는다** — Polar 상품 설정이 청구 source of truth다(PRD)

### checkout — 동작
8. 이미 `plan === 'pro'`면 checkout을 만들지 않고 `/dashboard`로 보낸다 (중복 구독 방지)
9. `profiles.polar_customer_id`가 있으면 그 customer로 연결한다 — 재구독 시 새 customer가 생기면 안 된다
10. Polar SDK가 던지면 502 + `{ error: 'upstream' }` (고정 어휘)
11. 성공 시 checkout URL로 리다이렉트한다

### portal
12. 세션 없으면 401
13. `polar_customer_id`가 없으면 **404 또는 400** — 결제한 적 없는 사용자에게 포털이 없다. 여기서 customer를 새로 만들지 마라
14. 있으면 포털 세션을 만들어 리다이렉트한다
15. 요청의 `customerId`를 무시하고 **DB의 값**을 쓴다. 이게 뚫리면 남의 결제 정보를 본다
16. SDK 실패 시 502 + `upstream`

### 권한을 열지 않는다 ← ADR-020
17. **두 라우트 어디에서도 `profiles.plan`을 바꾸지 않는다.** Supabase update mock이 `plan`을 포함해 호출되지 않음을 assert하라. plan은 **검증된 웹훅 transaction 안에서만** 바뀐다

### 로깅
18. 토큰·고객 식별자·이메일이 로그에 없다

## Codex 실행 지시문

### 요청에서 읽는 것은 아무것도 없다

```ts
// checkout
const { data: { user } } = await getUser();          // 세션에서
const productId = getProductId();                    // 환경변수에서
const returnUrl = `${getSiteUrl()}/dashboard?checkout=1`;   // 서버가 구성

// 요청 본문을 파싱조차 하지 마라 — 읽을 것이 없다.
```

ARCHITECTURE.md: *"checkout은 서버가 `POLAR_PRODUCT_ID` 하나만 허용하고 `external_customer_id=user.id`를 싣는다. **요청의 product ID·user ID·return URL을 신뢰하지 않는다.**"*

본문을 파싱하지 않으면 신뢰할 것도 없다. **가장 단순한 방어다.**

### `external_customer_id`가 연결 고리다

웹훅(step 2)이 이 값으로 우리 사용자를 찾는다. **반드시 `user.id`(Supabase auth uid)여야 한다.** 이메일이나 다른 식별자를 쓰지 마라 — 이메일은 바뀔 수 있다.

### customer ID의 단일 출처

ARCHITECTURE.md §DB 스키마: `polar_customer_id text unique, -- customer ID의 단일 출처`

이미 있으면 그것을 쓰고, 없으면 Polar가 만들게 둔 뒤 **웹훅이 저장한다.** 이 라우트에서 `profiles`에 쓰지 마라 — 쓰기 주체를 하나로 유지한다.

### return URL은 `/dashboard?checkout=1` 하나

ADR-020:

> return URL은 서버가 구성하며 `/dashboard?checkout=1`이다. 대시보드는 `profiles.plan`을 **서버에서 읽어** 화면을 정하고, `checkout=1`은 아직 Free일 때 "결제 확인 중" 안내를 띄우는 데만 쓴다. **쿼리 파라미터가 여는 것은 안내 문구지 기능이 아니다.** 전용 성공 페이지와 상태 폴링 라우트는 두지 않는다.

`/billing/success` 페이지를 만들지 마라. `/api/billing/status` 폴링 라우트를 만들지 마라.

### `plan`을 여기서 바꾸지 마라

ADR-020: *"success URL·checkout ID·클라이언트 응답은 권한 근거가 아니다. `profiles.plan`은 검증된 웹훅 transaction 안에서만 바뀐다."*

이 라우트에서 낙관적으로 `pro`로 바꾸고 싶어질 것이다. **바꾸지 마라.** 결제가 실패해도 Pro가 되고, 그걸 되돌릴 웹훅이 안 올 수도 있다.

### portal은 customer를 만들지 않는다

`polar_customer_id`가 없다는 건 **결제한 적이 없다는 뜻**이다. 포털에 보여줄 게 없다. customer를 새로 만들어 빈 포털을 열지 마라 — 사용자가 혼란스럽고 Polar에 유령 customer가 쌓인다.

화면(`/upgrade`·대시보드)이 `plan === 'free'`면 포털 링크를 아예 안 보여주는 것이 정답이다.

### 결제수단·영수증 UI를 만들지 마라

PRD: *"결제수단·영수증·취소 UI는 만들지 않는다 — Polar Customer Portal에 위임."*

## 완료 조건

- 두 라우트 + 테스트가 존재하고 18개 항목이 전부 통과한다
- checkout이 요청 본문을 신뢰하지 않는다 (파싱조차 안 하는 것이 이상적)
- `external_customer_id`가 세션의 `user.id`다
- return URL이 `getSiteUrl()` 기반이다
- **두 라우트 어디에서도 `plan`을 바꾸지 않는다**
- portal이 customer를 새로 만들지 않는다
- 에러가 고정 어휘다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/app/api/billing
```

직접 확인:

```bash
grep -rnE "req\.json\(\)|searchParams" src/app/api/billing/checkout/route.ts && echo "확인 필요: 요청에서 무언가 읽는다" || echo "OK"
grep -rn "plan" src/app/api/billing/*/route.ts | grep -iE "update|upsert|set" && echo "FAIL: 라우트가 plan 을 바꾼다" || echo "OK"
ls src/app/billing 2>/dev/null && echo "FAIL: 전용 성공 페이지" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §Polar 결제 — 요청의 product ID·user ID·return URL을 신뢰하지 않는가?
   - ADR-020 — `plan`을 웹훅 밖에서 바꾸지 않는가? 전용 성공 페이지·폴링 라우트를 안 만들었는가?
   - ADR-007 — 결제수단·영수증·취소 UI를 안 만들었는가?
   - ARCHITECTURE.md §디렉토리 구조 — `api/billing/{checkout,portal}/route.ts` 위치인가?
   - AGENTS.md CRITICAL — 외부 SDK 호출이 라우트 안에만 있는가? 에러가 고정 어휘인가? 로그에 PII 없는가?
3. 결과에 따라 `phases/5-billing/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/api/billing/{checkout,portal}/route.ts — checkout은 요청 본문을 읽지 않고 productId=env·external_customer_id=session user.id·returnUrl=getSiteUrl()+/dashboard?checkout=1, 이미 pro면 대시보드로. portal은 DB의 polar_customer_id만 쓰고 없으면 거절(customer 생성 안 함). 두 라우트 모두 plan을 바꾸지 않는다")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(5-billing): step 1 — billing-routes`

포함: `src/app/api/billing/**`

## 금지사항

- **요청 본문·쿼리에서 product ID·user ID·return URL·가격을 읽지 마라.** 이유: 하나라도 신뢰하면 누구나 임의 상품·임의 사용자·임의 리다이렉트를 만들 수 있다(ARCHITECTURE.md §Polar 결제).
- **이 라우트에서 `profiles.plan`을 바꾸지 마라.** 이유: success URL·checkout ID·클라이언트 응답은 권한 근거가 아니다. 결제가 실패해도 Pro가 되고 되돌릴 웹훅이 안 올 수 있다(ADR-020).
- **`/billing/success` 페이지를 만들지 마라.**
- **`/api/billing/status` 폴링 라우트를 만들지 마라.** 이유: 웹훅은 보통 수 초 안에 도착하고, 늦으면 새로고침이 답이다(ADR-020).
- **portal에서 customer를 새로 만들지 마라.** 이유: 결제한 적 없는 사용자에게 빈 포털을 열면 혼란스럽고 Polar에 유령 customer가 쌓인다.
- **`profiles.polar_customer_id`를 여기서 쓰지 마라.** 이유: 쓰기 주체는 웹훅 하나다.
- **결제수단·영수증·취소 UI를 만들지 마라.** 이유: Polar Customer Portal에 위임했다(ADR-007).
- **다단계 요금제·쿠폰·프로모션 코드를 만들지 마라.** 이유: 단일 상품 월 구독이다.
- **에러 어휘를 늘리지 마라.**
- **로그에 토큰·고객 식별자·이메일을 남기지 마라.**
- 기존 테스트를 깨뜨리지 마라.
