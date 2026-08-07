# Step 2: polar-webhook

## 목적

`POST /api/webhook/polar` — 서명 검증된 웹훅으로 `profiles.plan`을 갱신한다.

**이것이 Pro 권한의 유일한 출처다**(ADR-020). 다른 어떤 경로도 `plan`을 `pro`로 바꾸지 않는다.

네 가지가 여기서 지켜져야 하고, **하나라도 틀리면 "결제는 성공했는데 영원히 Free"가 된다**:

1. **원문 body 서명 검증이 가장 먼저** — 검증 전 JSON 파싱·DB 쓰기·로그 출력 금지
2. **`webhook_events` INSERT와 `profiles` 갱신은 한 transaction** (ADR-021)
3. **순서 역전 방어 2단** — `source_modified_at` + subscription ID 일치
4. **구독 종료는 `plan`을 되돌릴 뿐 데이터를 건드리지 않는다** (ADR-008)

## 이전 Step과의 의존성

- **step 0 (`polar-client`)** — `getWebhookSecret`. 그 step의 `summary`에 SDK API 이름과 `@polar-sh/nextjs` 헬퍼 유무가 있다
- **step 1 (`billing-routes`)** — `external_customer_id`가 세션 `user.id`라는 계약
- **Phase 0 step 3 (`db-schema`)** — `profiles`·`webhook_events` 테이블
- **Phase 0 step 4** — `createServiceClient()` (웹훅에는 사용자 컨텍스트가 없다)

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§Polar 결제 전문** · §Supabase 키 사용 규칙의 「Polar 웹훅」 행 · §DB 스키마의 `profiles`·`webhook_events`
- `/docs/ADR.md` — **ADR-021 전문** · ADR-020 · ADR-008
- `/docs/PRD.md` — UC-14 · UC-15 · §구독 종료 후 접근 정책
- `/src/services/polar/client.ts` · `/src/app/api/billing/checkout/route.ts`
- `/supabase/migrations/0001_schema.sql`

## 구현 범위

```
supabase/migrations/0008_polar_event_fn.sql   — plpgsql 함수 (멱등 기록 + plan 갱신을 한 transaction으로)
src/app/api/webhook/polar/route.ts            — POST
```

**번호가 0008인 이유**: `0005_grants.sql`·`0006_upload_error_detail.sql`·`0007_upload_recompute.sql`이 이미 있다. 0008이 다음 빈 번호다. 앞 번호로 되돌리지 마라.

**왜 plpgsql 함수인가**: Supabase JS 클라이언트는 여러 문장을 하나의 transaction으로 묶지 못한다. ADR-021이 요구하는 원자성을 만족하려면 DB 함수 하나로 내려야 한다.

```sql
-- 시그니처 수준 스펙
create or replace function apply_polar_event(
  p_event_id text, p_event_type text, p_event_created_at timestamptz,
  p_user_id uuid, p_plan text,
  p_customer_id text, p_subscription_id text, p_modified_at timestamptz
) returns text   -- 'applied' | 'duplicate' | 'stale' | 'subscription_mismatch'
language plpgsql
security definer
set search_path = ''   -- ← 생략 금지. 아래 「search_path를 고정하라」 참고
as $$ … $$;
```

## 수정 대상 파일

```
supabase/migrations/0008_polar_event_fn.sql     (신규)
src/app/api/webhook/polar/route.ts              (신규)
src/app/api/webhook/polar/route.test.ts         (신규 — 먼저)
supabase/migrations.test.ts                     (수정 — 새 마이그레이션 불변식 추가)
```

## 먼저 작성할 테스트

### 서명 검증이 가장 먼저 ← 순서가 핵심
1. **`req.text()`로 raw body를 받는다.** `req.json()`을 먼저 부르면 body가 소비돼 검증이 깨진다. 소스에서 `req.json()` 부재를 검사하라
2. 서명이 없으면 401. **JSON 파싱을 시도하지 않는다** (파서 mock 호출 0회)
3. 서명이 틀리면 401. DB mock 호출 0회
4. **검증 실패 시 body를 로그에 남기지 않는다** — `console` spy로 body 문자열 부재 확인
5. 서명이 맞을 때만 파싱한다

### 멱등 + 원자성 ← ADR-021
6. 같은 `event_id`가 두 번 오면 두 번째는 **`duplicate`**이고 `profiles`가 안 바뀐다
7. **`webhook_events` INSERT와 `profiles` UPDATE가 한 RPC 호출로 나간다.** 두 번의 개별 쿼리로 나가지 않음을 assert하라. 이게 ADR-021의 전부다
8. RPC가 실패하면 **5xx를 반환한다** — Polar가 재전송하게 해야 한다. 200을 주면 영원히 잃는다

### 순서 역전 방어 2단 ← ARCHITECTURE.md
9. `modified_at`이 저장된 `source_modified_at`보다 **오래되면 무시**한다 (`stale`)
10. `modified_at`이 같거나 새로우면 적용한다
11. **subscription ID가 `profiles.polar_subscription_id`와 다르면 무시**한다 (`subscription_mismatch`) — 재구독 시 옛 구독의 지연된 `revoked`가 새 구독을 죽이는 것을 막는다
12. 단, 현재 `polar_subscription_id`가 `null`이면(첫 구독) 통과한다
13. 무시된 이벤트도 **`webhook_events`에는 기록된다** (재전송에 다시 처리하지 않기 위해)

### 이벤트 → plan 매핑
14. 구독 활성(`active`) → `plan: 'pro'`
15. `past_due` → **`pro` 유지**. 우리 쪽 유예 타이머를 만들지 않는다(ARCHITECTURE.md)
16. `unpaid` → `plan: 'free'`
17. `revoked`/`canceled` 확정 → `plan: 'free'`
18. 알 수 없는 이벤트 타입 → **200을 반환하고 아무것도 안 한다.** 재전송을 유발하지 마라

### 사용자 연결
19. `external_customer_id`로 `profiles.user_id`를 찾는다
20. 찾을 수 없으면 **200을 반환한다** (재전송해도 못 찾는다) 그리고 로그에 코드만 남긴다
21. `polar_customer_id`를 `profiles`에 저장한다 (없었으면)

### 데이터를 건드리지 않는다 ← ADR-008
22. **어떤 경로에서도 `uploads`·`transactions`를 삭제·수정하지 않는다.** 두 테이블에 대한 mock 호출 0회를 assert하라. 이 테스트 하나가 ADR-008을 지킨다
23. `free`로 되돌릴 때도 마찬가지다

### 로깅
24. **웹훅 원문 body가 로그에 없다**(AGENTS.md CRITICAL)
25. 이메일·customer ID가 로그에 없다
26. 남기는 것은 이벤트 타입과 처리 결과 코드뿐이다

### 마이그레이션 불변식 (`migrations.test.ts` 추가)
27. `apply_polar_event` 함수에 `webhook_events` INSERT와 `profiles` UPDATE가 **둘 다** 있다
28. 함수에 `uploads`·`transactions`에 대한 DELETE/UPDATE가 **없다**
29. `subscriptions` 테이블을 만들지 않는다
30. `apply_polar_event`가 `security definer`이면서 **`set search_path = ''`가 붙어 있다** — 함수 정의에서 둘 다 검사하라. 기존 `replace_upload_result` 불변식(`migrations.test.ts`)과 같은 형태로 쓴다

## Codex 실행 지시문

### 서명 검증 전에는 아무것도 하지 마라

```ts
export async function POST(req: Request) {
  const raw = await req.text();                    // ✅ raw body 먼저
  const sig = req.headers.get('webhook-signature'); // 실제 헤더 이름은 SDK 문서/타입 확인
  if (!verify(raw, sig, getWebhookSecret())) {
    return new Response(null, { status: 401 });     // 로그에 raw 를 남기지 마라
  }
  const event = JSON.parse(raw);                    // 여기서야 파싱
  …
}
```

ARCHITECTURE.md: *"웹훅은 **원문 body 서명 검증을 가장 먼저** 한다. 검증 전 JSON 파싱·DB 쓰기·로그 출력 금지 (`await req.text()`로 raw body를 받아야 하며, 먼저 `req.json()`을 호출하면 검증이 깨진다)."*

`@polar-sh/nextjs`가 웹훅 핸들러 팩토리를 제공한다면 써도 된다 — 단 **그것이 raw body로 검증하는지 소스/타입에서 확인하고** `summary`에 남겨라.

### 한 transaction — plpgsql로 내려라

```ts
const { data, error } = await supabase.rpc('apply_polar_event', { … });
if (error) return new Response(null, { status: 500 });   // Polar 가 재전송한다
```

ADR-021: *"분리하면 크래시 시 이벤트가 *처리됨*으로 기록된 채 반영되지 않고, Polar의 재전송마저 멱등 검사에 걸려 버려진다 → 결제는 성공했는데 영원히 Free."*

**`webhook_events` INSERT를 먼저 하고 `profiles`를 나중에 업데이트하는 두 쿼리로 만들지 마라.** 성능을 이유로도 분리하지 마라 — ADR이 명시적으로 금지했다.

함수 안 순서:
1. `insert into webhook_events (event_id, …) on conflict do nothing` → 삽입된 행이 0이면 `duplicate` 반환
2. `profiles`를 `for update`로 잠그고 `source_modified_at`·`polar_subscription_id` 검사
3. 통과하면 `plan`·`polar_customer_id`·`polar_subscription_id`·`source_modified_at` 갱신
4. 결과 코드 반환

**1번이 먼저인 것이 멱등의 핵심이다.** 같은 transaction 안이므로 3번이 실패하면 1번도 롤백된다.

### 순서 역전 방어는 2단이다

ARCHITECTURE.md: *"순서 역전 방어 2단: `modified_at`이 저장된 `source_modified_at`보다 오래되면 무시 **+ subscription ID가 현재 값과 일치하는지 확인**(재구독 시 옛 구독의 지연된 `revoked`가 새 구독을 죽이는 것을 막는다)."*

타임스탬프만으로는 부족하다. 시나리오: 사용자가 해지 → 재구독. 옛 구독의 `revoked`가 새 구독의 `active`보다 늦게 도착하면, 타임스탬프는 `revoked`가 더 새로울 수 있다(발생 시각이 아니라 전송 순서 문제). subscription ID가 다르면 무시해야 한다.

### `past_due`는 Pro 유지

ARCHITECTURE.md: *"`past_due`는 Polar가 `unpaid`/`revoked`를 보낼 때까지 Pro 유지. **우리 쪽 유예 타이머를 만들지 않는다**."*

`past_due` 이벤트에 "3일 뒤 잠금" 같은 로직을 넣지 마라. Polar가 판단한다.

### 구독 종료가 데이터를 건드리지 않는다

ARCHITECTURE.md: *"**구독 종료는 `profiles.plan`을 `free`로 되돌릴 뿐 데이터를 건드리지 않는다.** 웹훅 핸들러에서 `uploads`·`transactions`를 삭제하거나 익명화하지 마라 — 재구독 시 그대로 다시 열려야 한다."*

이걸 "정리"라고 생각해서 넣지 마라. 재구독 사용자에게 재분석을 강요해 우리 원가를 태우고, 세무 자료를 잃은 사용자에게 신뢰를 잃는다(ADR-008).

### 알 수 없는 이벤트에 200

Polar가 우리가 모르는 이벤트를 보낼 수 있다. **200을 주고 무시하라.** 4xx/5xx를 주면 Polar가 계속 재전송한다.

### 로깅

```ts
// ✅ console.info(JSON.stringify({ event: 'polar_webhook', type, result }));
// ❌ console.log(raw)  · console.error(event)  · console.log(customerId)
```

AGENTS.md CRITICAL: *"로그에 PII를 남기지 마라. … 웹훅 원문 body 금지."*

### `service role`을 쓴다

웹훅에는 사용자 컨텍스트가 없다. **서명 검증이 유일한 관문이다**(ARCHITECTURE.md §Supabase 키 사용 규칙).

### search_path를 고정하라

`apply_polar_event`는 `security definer`다 — 호출자가 아니라 **함수 소유자 권한으로 돈다**. search_path를 고정하지 않으면 호출자가 제어하는 스키마가 앞에 끼어들 수 있고, 함수 안의 `webhook_events`·`profiles`가 공격자가 심은 동명 테이블로 해석된다. 소유자 권한으로.

**이 레포의 관행은 `set search_path = ''`다** — `0001_schema.sql`의 `handle_new_auth_user`, `0007_upload_recompute.sql`의 `replace_upload_result` 둘 다 그렇다. 새 함수도 맞춰라.

```sql
create or replace function apply_polar_event(…)
returns text
language plpgsql
security definer
set search_path = ''   -- ✅ 정의에 못박는다
as $$ … $$;
```

- **`set search_path`를 빠뜨리지 마라.** 함수 정의에 붙여라 — 함수 본문 안에서 `set search_path`를 실행하는 것으로 대신하지 마라.
- **`''`는 스키마 한정을 선택이 아니라 필수로 만든다.** 검색 경로가 비었으므로 한정하지 않은 이름은 아무것도 찾지 못하고 함수가 런타임에 죽는다. 이게 이 설정의 요점이다 — 이름 해석이 조용히 엉뚱한 객체로 가는 대신 즉시 실패한다.
- 함수 본문의 **모든 DB 객체를 스키마 한정**하라. 테이블만이 아니라 함수·타입·연산자까지다: `public.webhook_events`·`public.profiles`, `public.now()`가 아닌 내장 함수라면 `pg_catalog.now()`. 한정을 빠뜨리면 `relation "profiles" does not exist`로 터진다.

```sql
-- ✅
insert into public.webhook_events (event_id, …) on conflict do nothing;
update public.profiles set plan = p_plan where user_id = p_user_id;

-- ❌ search_path = '' 에서는 찾지 못한다
insert into webhook_events (event_id, …) on conflict do nothing;
update profiles set plan = p_plan where user_id = p_user_id;
```

### `subscriptions` 테이블을 만들지 마라

ADR-021. 앱이 묻는 질문은 "Pro인가" 하나다.

## 완료 조건

- 마이그레이션 + 라우트 + 테스트가 존재하고 30개 항목이 전부 통과한다
- 마이그레이션 파일명이 `supabase/migrations/0008_polar_event_fn.sql`이다
- `apply_polar_event`가 `security definer` + `set search_path = ''`이고, 본문의 DB 객체가 전부 스키마 한정돼 있다
- `req.json()`이 소스에 없다 (raw body 검증)
- 검증 실패 시 파싱·DB·로그가 없다
- 멱등 기록과 `plan` 갱신이 **한 RPC 호출**이다
- 순서 역전 방어 2단이 있다
- `past_due`가 Pro를 유지한다
- **`uploads`·`transactions`를 건드리지 않는다**
- 알 수 없는 이벤트에 200
- 로그에 body·customer ID가 없다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/app/api/webhook/polar/route.test.ts supabase/migrations.test.ts
```

직접 확인:

```bash
test -f supabase/migrations/0008_polar_event_fn.sql && echo "OK" || echo "FAIL: 마이그레이션 파일명이 0008이 아니다"
grep -n "req.json()" src/app/api/webhook/polar/route.ts && echo "FAIL: 서명 검증이 깨진다" || echo "OK"
grep -nE "uploads|transactions" src/app/api/webhook/polar/route.ts supabase/migrations/0008_polar_event_fn.sql && echo "FAIL: 데이터를 건드린다" || echo "OK"
grep -nE "security\s+definer" supabase/migrations/0008_polar_event_fn.sql || echo "FAIL: security definer 아님"
grep -nE "set\s+search_path\s*=\s*''" supabase/migrations/0008_polar_event_fn.sql || echo "FAIL: search_path 미고정"
grep -nEi "(insert into|update|delete from)\s+(webhook_events|profiles)\b" supabase/migrations/0008_polar_event_fn.sql && echo "FAIL: 스키마 미한정 (search_path='' 에서 죽는다)" || echo "OK"
grep -c "rpc(" src/app/api/webhook/polar/route.ts    # 1 이어야 한다
grep -nE "setTimeout|유예|grace" src/app/api/webhook/polar/route.ts && echo "FAIL: 유예 타이머" || echo "OK"
```

**경로를 와일드카드로 쓰지 마라.** `supabase/migrations/0008_*.sql`이 아니라 `supabase/migrations/0008_polar_event_fn.sql`을 정확히 지정한다. 와일드카드를 쓰면 이 step이 만들지 않은 기존 마이그레이션(`0005_grants.sql`은 `uploads`·`transactions`에 `grant`를 거는 파일이다)이 검사 대상에 딸려 들어와 거짓 실패가 난다.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §Polar 결제 — 서명 검증이 가장 먼저인가? 한 transaction인가? 순서 역전 2단인가? `past_due`가 Pro 유지인가?
   - ADR-021 — `webhook_events` INSERT와 `profiles` 갱신이 나뉘지 않았는가? `subscriptions` 테이블이 없는가?
   - ADR-008 — `uploads`·`transactions`를 건드리지 않는가?
   - ADR-020 — 이곳이 `plan`을 바꾸는 유일한 경로인가?
   - AGENTS.md CRITICAL — 로그에 웹훅 body가 없는가? service role을 쓰는가?
   - 마이그레이션에 `DROP TABLE`이 없는가?
3. 결과에 따라 `phases/5-billing/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "migrations/0008_polar_event_fn.sql의 apply_polar_event() plpgsql(security definer + search_path='' + 전 객체 스키마 한정; webhook_events on conflict do nothing → profiles for update → 검증 → 갱신, 결과 코드 applied/duplicate/stale/subscription_mismatch) + api/webhook/polar/route.ts. req.text() 원문 서명 검증 최우선, 단일 RPC, 순서 역전 2단(source_modified_at + subscription id), past_due는 pro 유지, uploads/transactions 미접촉, 알 수 없는 이벤트는 200")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. `summary`에 **마이그레이션 `0008_polar_event_fn.sql`을 DB에 적용해야 한다**는 사실을 남겨라.

## commit 기준

`feat(5-billing): step 2 — polar-webhook`

포함: `supabase/migrations/0008_polar_event_fn.sql` · `src/app/api/webhook/polar/route.{ts,test.ts}` · `supabase/migrations.test.ts`

## 금지사항

- **`req.json()`을 서명 검증 전에 부르지 마라.** 이유: body가 소비돼 원문 검증이 깨진다.
- **검증 전에 파싱·DB 쓰기·로그 출력을 하지 마라.** 이유: 검증되지 않은 입력이다.
- **`webhook_events` INSERT와 `profiles` 갱신을 나누지 마라 — 성능을 이유로도.** 이유: 크래시 시 이벤트가 처리됨으로 기록된 채 반영되지 않고, 재전송마저 멱등 검사에 걸려 버려진다 → 결제는 성공했는데 영원히 Free(ADR-021).
- **RPC 실패에 200을 반환하지 마라.** 이유: Polar가 재전송하지 않으면 영원히 잃는다.
- **순서 역전 방어를 타임스탬프 한 겹으로 끝내지 마라.** 이유: 재구독 시 옛 구독의 지연된 `revoked`가 새 구독을 죽인다.
- **`past_due`에 우리 쪽 유예 타이머를 만들지 마라.** 이유: Polar가 `unpaid`/`revoked`를 보낼 때 잠근다.
- **웹훅에서 `uploads`·`transactions`를 삭제·익명화하지 마라.** 이유: 재구독 시 그대로 다시 열려야 한다. 재분석을 강요하면 우리 원가를 태우고 신뢰를 잃는다(ADR-008).
- **`security definer` 함수를 `set search_path` 없이 만들지 마라.** 이유: 소유자 권한으로 도는 함수에서 테이블 이름이 호출자가 심은 동명 객체로 해석될 수 있다. 이 레포의 관행대로 정의에 `set search_path = ''`를 못박고, 본문의 DB 객체를 전부 스키마 한정하라.
- **`subscriptions` 테이블을 만들지 마라.**
- **알 수 없는 이벤트에 4xx/5xx를 주지 마라.** 이유: 무한 재전송을 유발한다.
- **웹훅 원문 body·customer ID·이메일을 로그에 남기지 마라.**
- **마이그레이션에 `DROP TABLE`을 쓰지 마라.**
- 기존 테스트를 깨뜨리지 마라.
