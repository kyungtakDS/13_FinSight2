# Step 3: polar-webhook

## 목적

`POST /api/webhook/polar` — 서명 검증된 웹훅으로 `profiles.plan`을 갱신한다.

**이것이 Pro 권한의 유일한 출처다**(ADR-020). 다른 어떤 경로도 `plan`을 `pro`로 바꾸지 않는다.

이 step은 **라우트 핸들러만 만든다.** DB 함수 `apply_polar_event`와 그 GRANT는 **step 1(`billing-schema`)이 이미 만들었다.** 여기서 마이그레이션을 쓰지 마라.

네 가지가 여기서 지켜져야 하고, **하나라도 틀리면 "결제는 성공했는데 영원히 Free"가 된다**:

1. **원문 body 서명 검증이 가장 먼저** — 검증 전 JSON 파싱·DB 쓰기·로그 출력 금지
2. **`webhook_events` INSERT와 `profiles` 갱신은 한 transaction** (ADR-021) — RPC 한 번으로
3. **순서 역전 방어 2단** — `source_modified_at` + subscription ID 일치
4. **구독 종료는 `plan`을 되돌릴 뿐 데이터를 건드리지 않는다** (ADR-008)

## 이전 Step과의 의존성

- **step 0 (`polar-client`)** — `getWebhookSecret`. 그 step의 `summary`에 SDK API 이름이 있다
- **step 1 (`billing-schema`)** — `apply_polar_event` RPC의 **인자 순서와 반환 어휘**. `phases/5-billing/index.json`의 step 1 `summary`와 `supabase/migrations/0008_polar_event_fn.sql`을 반드시 읽어라
- **step 2 (`billing-routes`)** — `external_customer_id`가 세션 `user.id`라는 계약
- **Phase 0 step 4** — `createServiceClient()` (웹훅에는 사용자 컨텍스트가 없다)

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§Polar 결제 전문** · §Supabase 키 사용 규칙의 「Polar 웹훅」 행 · §DB 스키마의 `profiles`·`webhook_events`
- `/docs/ADR.md` — **ADR-021 전문** · ADR-020 · **ADR-008** · **ADR-023(SDK 헬퍼 미사용)**
- `/phases/PLAN.md` — **D-11 ~ D-14, D-16** (이벤트 매핑과 서명 검증 방식의 결정 근거)
- `/docs/PRD.md` — UC-14 · UC-15 · §구독 종료 후 접근 정책
- `/supabase/migrations/0008_polar_event_fn.sql` — **step 1 산출물. RPC 시그니처의 단일 출처**
- `/src/services/polar/client.ts` · `/src/app/api/billing/checkout/route.ts`
- `node_modules/@polar-sh/sdk/dist/commonjs/models/components/` 의 `webhooksubscription*payload` 와 `subscriptionstatus` — **이벤트 타입·status 값을 여기서 확인하라. 추측하지 마라**

## 구현 범위

```
src/app/api/webhook/polar/route.ts      — POST
```

**마이그레이션을 만들지 마라.** `0008`은 step 1이 이미 만들었다.

## 수정 대상 파일

```
src/app/api/webhook/polar/route.ts              (신규)
src/app/api/webhook/polar/route.test.ts         (신규 — 먼저)
```

## 서명 검증 — `Webhooks` 헬퍼를 쓰지 마라 (D-14)

`@polar-sh/nextjs`의 `Webhooks()` 헬퍼는 raw body 검증 자체는 올바르게 하지만
(`dist/index.js`: `await request.text()` → `validateEvent`), 응답 코드를 우리가 통제할 수 없다.
검증 실패에 **403**을 반환하고, 성공 시 `{received:true}` 200을 강제한다.

**`@polar-sh/sdk/webhooks`의 `validateEvent`를 직접 부른다.**

```ts
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const raw = await req.text();                     // ✅ raw body 먼저
  let event;
  try {
    event = validateEvent(
      raw,
      {
        'webhook-id':        req.headers.get('webhook-id') ?? '',
        'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
        'webhook-signature': req.headers.get('webhook-signature') ?? '',
      },
      getWebhookSecret(),
    );
  } catch (e) {
    if (e instanceof WebhookVerificationError) {
      return new Response(null, { status: 401 });   // 로그에 raw 를 남기지 마라
    }
    throw e;
  }
  …
}
```

헤더 이름 3개(`webhook-id`·`webhook-timestamp`·`webhook-signature`)는 Standard Webhooks 규격이고
`@polar-sh/nextjs@0.9.6`의 구현에서 확인된 값이다. **그래도 설치된 SDK의 타입에서 다시 확인하라.**

## 이벤트 → plan 매핑 ← D-11 · D-12 · D-13

**`subscription.unpaid` 이벤트는 존재하지 않는다.** `@polar-sh/sdk@0.49.0`의 웹훅 페이로드는
아래 9개뿐이고, `unpaid`는 `SubscriptionStatus` enum의 값으로 `subscription.updated`
안에서만 온다. 이걸 이벤트 타입으로 착각하면 `unpaid` 처리가 영원히 안 돈다.

| 이벤트 타입 | 처리 |
|---|---|
| `subscription.created` | `data.status`에서 파생 |
| `subscription.updated` | `data.status`에서 파생 ← **`unpaid`가 여기로 온다** |
| `subscription.active` | `pro` |
| `subscription.uncanceled` | `pro` |
| `subscription.resumed` | `pro` |
| `subscription.past_due` | **`pro` 유지** — 우리 쪽 유예 타이머 없음 |
| `subscription.canceled` | **`pro` 유지** ← **D-11. 해지 예약일 뿐이다** |
| `subscription.paused` | `free` |
| `subscription.revoked` | **`free`** ← 실제 종료는 여기다 |
| 그 외 전부 (`order.*` 등) | **200 + 아무것도 안 함** |

`data.status` → plan 파생 (`SubscriptionStatus` 8값 전부를 덮어라):

| status | plan | 근거 |
|---|---|---|
| `active` | `pro` | |
| `trialing` | `pro` | **D-13** |
| `past_due` | `pro` | 유예 타이머 없음. Polar가 판단한다 |
| `unpaid` | `free` | **D-12** |
| `paused` | `free` | **D-13** |
| `canceled` | `free` | 단 아래 이중 안전장치를 보라 |
| `incomplete` | `free` | 첫 결제 미완료 |
| `incomplete_expired` | `free` | |

### 이중 안전장치 — `canceled` 이벤트는 어떤 경우에도 내리지 않는다

`subscription.canceled` 이벤트가 도착할 때 `data.status`가 `active`(해지 예약, 기간 남음)인지
`canceled`인지는 Polar 구현에 달렸고 **우리가 확정할 수 없다.** 그래서 두 겹으로 막는다:

1. `data.status`에서 plan을 파생하고,
2. **이벤트 타입이 `subscription.canceled`면 파생 결과를 무시하고 `pro`를 유지한다.**

이러면 status가 어느 쪽으로 오든 결과가 같다. **D-11의 약속("결제한 기간 끝까지 이용")이
Polar의 내부 표현에 의존하지 않게 된다.** 실제 종료는 `revoked`가 온다.

## 먼저 작성할 테스트

### 서명 검증이 가장 먼저 ← 순서가 핵심 (게이트 G4)
1. **`req.text()`로 raw body를 받는다.** `req.json()`을 먼저 부르면 body가 소비돼 검증이 깨진다. 소스에서 `req.json()` 부재를 검사하라
2. 서명이 없으면 **401**. **JSON 파싱을 시도하지 않는다** (파서 mock 호출 0회)
3. 서명이 틀리면 **401**. DB mock 호출 0회
4. **검증 실패 시 body를 로그에 남기지 않는다** — `console` spy로 body 문자열 부재 확인
5. 서명이 맞을 때만 파싱한다
6. **`@polar-sh/nextjs`의 `Webhooks`를 import하지 않는다** (D-14) — 소스 검사

### 멱등 + 원자성 ← ADR-021
7. 같은 `event_id`가 두 번 오면 두 번째는 **`duplicate`**이고 `profiles`가 안 바뀐다
8. **`webhook_events` INSERT와 `profiles` UPDATE가 한 RPC 호출로 나간다.** `.from('profiles').update`·`.from('webhook_events').insert`가 **0회**임을 assert하라. 이게 ADR-021의 전부다 (G1)
9. RPC가 실패하면 **5xx를 반환한다** — Polar가 재전송하게 해야 한다. 200을 주면 영원히 잃는다

### 순서 역전 방어 2단
10. `modified_at`이 저장된 `source_modified_at`보다 **오래되면 무시**한다 (`stale`)
11. `modified_at`이 같거나 새로우면 적용한다
12. **subscription ID가 `profiles.polar_subscription_id`와 다르면 무시**한다 (`subscription_mismatch`)
13. 단, 현재 `polar_subscription_id`가 `null`이면(첫 구독) 통과한다
14. 무시된 이벤트도 **`webhook_events`에는 기록된다** (재전송에 다시 처리하지 않기 위해)

### 이벤트 → plan 매핑 ← D-11 · D-12 · D-13
15. `subscription.active` → `pro`
16. `subscription.uncanceled` → `pro`
17. `subscription.resumed` → `pro`
18. `subscription.past_due` → **`pro` 유지**. 유예 타이머 없음
19. **`subscription.canceled` → `pro` 유지** (D-11). `data.status`가 `canceled`로 와도 `pro`다 ← 이중 안전장치 검증
20. **`subscription.revoked` → `free`** — 여기가 유일한 종료 지점
21. `subscription.paused` → `free` (D-13)
22. **`subscription.updated` + `data.status === 'unpaid'` → `free`** (D-12)
23. `subscription.updated` + `data.status === 'trialing'` → `pro` (D-13)
24. `subscription.updated` + `data.status === 'active'` → `pro`
25. `subscription.created` + `data.status === 'incomplete'` → `free`
26. **`SubscriptionStatus` 8값 전부에 대해 파생 함수가 정의돼 있다** — 테이블 주도 테스트로 8건
27. 알 수 없는 이벤트 타입(`order.created` 등) → **200을 반환하고 RPC를 부르지 않는다.** 재전송을 유발하지 마라

### 사용자 연결
28. `external_customer_id`로 `profiles.user_id`를 찾는다
29. 찾을 수 없으면 **200을 반환한다** (재전송해도 못 찾는다) 그리고 로그에 코드만 남긴다
30. `polar_customer_id`를 `profiles`에 저장한다 (없었으면) — **RPC 안에서**. 별도 UPDATE를 내지 마라

### 데이터를 건드리지 않는다 ← ADR-008 (G2)
31. **어떤 경로에서도 `uploads`·`transactions`를 삭제·수정하지 않는다.** 두 테이블에 대한 mock 호출 0회를 assert하라. 이 테스트 하나가 ADR-008을 지킨다
32. `free`로 되돌릴 때도 마찬가지다

### 로깅
33. **웹훅 원문 body가 로그에 없다**(AGENTS.md CRITICAL)
34. 이메일·customer ID·subscription ID가 로그에 없다
35. 남기는 것은 이벤트 타입과 처리 결과 코드뿐이다

## Codex 실행 지시문

### 검증 전에는 아무것도 하지 마라

ARCHITECTURE.md: *"웹훅은 **원문 body 서명 검증을 가장 먼저** 한다. 검증 전 JSON 파싱·DB 쓰기·로그 출력 금지."*

### 한 transaction — RPC 한 번

```ts
const { data, error } = await supabase.rpc('apply_polar_event', { … });
if (error) return new Response(null, { status: 500 });   // Polar 가 재전송한다
```

ADR-021: *"분리하면 크래시 시 이벤트가 *처리됨*으로 기록된 채 반영되지 않고, Polar의 재전송마저 멱등 검사에 걸려 버려진다 → 결제는 성공했는데 영원히 Free."*

**`webhook_events` INSERT를 먼저 하고 `profiles`를 나중에 업데이트하는 두 쿼리로 만들지 마라. 성능을 이유로도 분리하지 마라** — ADR이 명시적으로 금지했다. 인자 순서는 `0008_polar_event_fn.sql`에서 그대로 읽어 와라.

### 순서 역전 방어는 2단이다

타임스탬프만으로는 부족하다. 시나리오: 해지 → 재구독. 옛 구독의 `revoked`가 새 구독의 `active`보다 늦게 도착하면, 타임스탬프는 `revoked`가 더 새로울 수 있다(발생 시각이 아니라 전송 순서 문제). subscription ID가 다르면 무시해야 한다.

### `past_due`는 Pro 유지

ARCHITECTURE.md: *"`past_due`는 Polar가 `unpaid`/`revoked`를 보낼 때까지 Pro 유지. **우리 쪽 유예 타이머를 만들지 않는다**."*

`past_due` 이벤트에 "3일 뒤 잠금" 같은 로직을 넣지 마라. Polar가 판단한다.

### 구독 종료가 데이터를 건드리지 않는다

ARCHITECTURE.md: *"**구독 종료는 `profiles.plan`을 `free`로 되돌릴 뿐 데이터를 건드리지 않는다.**"*

이걸 "정리"라고 생각해서 넣지 마라. 재구독 사용자에게 재분석을 강요해 우리 원가를 태우고, 세무 자료를 잃은 사용자에게 신뢰를 잃는다(ADR-008).

### 알 수 없는 이벤트에 200

Polar가 우리가 모르는 이벤트(`order.*`·`benefit.*`·`customer.*`)를 보낸다. **200을 주고 무시하라.** 4xx/5xx를 주면 Polar가 계속 재전송한다. `webhook_events`에도 넣지 마라 — 우리가 처리하는 이벤트만 기록한다.

### 로깅

```ts
// ✅ console.info(JSON.stringify({ event: 'polar_webhook', type, result }));
// ❌ console.log(raw)  · console.error(event)  · console.log(customerId)
```

AGENTS.md CRITICAL: *"로그에 PII를 남기지 마라. … 웹훅 원문 body 금지."*

### `service role`을 쓴다

웹훅에는 사용자 컨텍스트가 없다. **서명 검증이 유일한 관문이다**(ARCHITECTURE.md §Supabase 키 사용 규칙). service_role은 `apply_polar_event` **EXECUTE만** 갖는다(D-16) — `profiles`에 직접 UPDATE를 시도하면 권한 에러가 난다. 그게 의도다.

### `subscriptions` 테이블을 만들지 마라

ADR-021. 앱이 묻는 질문은 "Pro인가" 하나다.

## 완료 조건

- 라우트 + 테스트가 존재하고 35개 항목이 전부 통과한다
- `req.json()`이 소스에 없다 (raw body 검증)
- `@polar-sh/nextjs`를 import하지 않는다 (D-14 · D-15)
- 검증 실패 시 401이고 파싱·DB·로그가 없다
- 멱등 기록과 `plan` 갱신이 **한 RPC 호출**이다
- 순서 역전 방어 2단이 있다
- `canceled`가 `pro`를 유지하고 `revoked`만 `free`로 내린다
- `unpaid`가 `subscription.updated`의 status로 처리된다
- **`uploads`·`transactions`를 건드리지 않는다**
- 알 수 없는 이벤트에 200
- 로그에 body·customer ID가 없다
- **마이그레이션 파일을 새로 만들지 않았다**
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/app/api/webhook/polar/route.test.ts
```

직접 확인:

```bash
grep -n "req.json()" src/app/api/webhook/polar/route.ts && echo "FAIL: 서명 검증이 깨진다" || echo "OK"
grep -n "@polar-sh/nextjs" src/app/api/webhook/polar/route.ts && echo "FAIL: D-14/D-15 위반" || echo "OK"
grep -nE "uploads|transactions" src/app/api/webhook/polar/route.ts && echo "FAIL: 데이터를 건드린다" || echo "OK"
grep -c "rpc(" src/app/api/webhook/polar/route.ts    # 1 이어야 한다
grep -nE "\.from\(.(profiles|webhook_events)" src/app/api/webhook/polar/route.ts && echo "FAIL: RPC 밖에서 쓴다" || echo "OK"
grep -nE "setTimeout|유예|grace" src/app/api/webhook/polar/route.ts && echo "FAIL: 유예 타이머" || echo "OK"
git status --porcelain supabase/migrations/ | grep . && echo "FAIL: 이 step 은 마이그레이션을 만들지 않는다" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §Polar 결제 (G4) — 서명 검증이 가장 먼저인가? 한 transaction인가? 순서 역전 2단인가? `past_due`가 Pro 유지인가?
   - ADR-021 (G1) — `webhook_events` INSERT와 `profiles` 갱신이 나뉘지 않았는가? `subscriptions` 테이블이 없는가?
   - ADR-008 (G2) — `uploads`·`transactions`를 건드리지 않는가? `canceled`가 잠그지 않는가?
   - ADR-020 — 이곳이 `plan`을 바꾸는 유일한 경로인가?
   - ADR-023 / D-14 · D-15 — SDK 프레임워크 헬퍼를 안 썼는가?
   - AGENTS.md CRITICAL — 로그에 웹훅 body가 없는가? service role을 쓰는가?
3. 결과에 따라 `phases/5-billing/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "api/webhook/polar/route.ts — validateEvent 직접 호출(@polar-sh/nextjs 미사용), req.text() 원문 서명 검증 최우선·실패 401, 단일 apply_polar_event RPC, 순서 역전 2단, canceled는 pro 유지·revoked만 free, unpaid는 subscription.updated의 status로, trialing→pro/paused→free, uploads·transactions 미접촉, 알 수 없는 이벤트는 200 무처리")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(5-billing): step 3 — polar-webhook`

포함: `src/app/api/webhook/polar/route.{ts,test.ts}`

## 금지사항

- **`req.json()`을 서명 검증 전에 부르지 마라.** 이유: body가 소비돼 원문 검증이 깨진다.
- **`@polar-sh/nextjs`의 `Webhooks`를 쓰지 마라.** 이유: 검증 실패에 403을 강제하고 성공 응답을 우리가 통제할 수 없다(D-14).
- **검증 전에 파싱·DB 쓰기·로그 출력을 하지 마라.** 이유: 검증되지 않은 입력이다.
- **`webhook_events` INSERT와 `profiles` 갱신을 나누지 마라 — 성능을 이유로도.** 이유: 크래시 시 이벤트가 처리됨으로 기록된 채 반영되지 않고, 재전송마저 멱등 검사에 걸려 버려진다 → 결제는 성공했는데 영원히 Free(ADR-021).
- **`subscription.canceled`에서 `free`로 내리지 마라.** 이유: 해지 예약일 뿐이고 결제한 기간이 남아 있다. 내리면 돈을 낸 사용자를 즉시 잠근다(D-11 · ADR-008).
- **`unpaid`를 이벤트 타입으로 다루지 마라.** 이유: `subscription.unpaid` 이벤트는 존재하지 않는다. `subscription.updated`의 `data.status`로만 온다(D-12).
- **RPC 실패에 200을 반환하지 마라.** 이유: Polar가 재전송하지 않으면 영원히 잃는다.
- **순서 역전 방어를 타임스탬프 한 겹으로 끝내지 마라.** 이유: 재구독 시 옛 구독의 지연된 `revoked`가 새 구독을 죽인다.
- **`past_due`에 우리 쪽 유예 타이머를 만들지 마라.** 이유: Polar가 `unpaid`/`revoked`를 보낼 때 잠근다.
- **웹훅에서 `uploads`·`transactions`를 삭제·익명화하지 마라.** 이유: 재구독 시 그대로 다시 열려야 한다(ADR-008).
- **`subscriptions` 테이블을 만들지 마라.**
- **마이그레이션 파일을 만들지 마라.** 이유: `0008`은 step 1이 만들었다. 두 step이 같은 파일을 만들면 번호가 또 충돌한다.
- **알 수 없는 이벤트에 4xx/5xx를 주지 마라.** 이유: 무한 재전송을 유발한다.
- **웹훅 원문 body·customer ID·이메일을 로그에 남기지 마라.**
- 기존 테스트를 깨뜨리지 마라.
