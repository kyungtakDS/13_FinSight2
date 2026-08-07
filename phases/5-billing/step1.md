# Step 1: billing-schema

## 목적

Polar 웹훅이 쓸 **DB 계약을 먼저 굳힌다.** `supabase/migrations/0008_polar_event_fn.sql` 하나와 그것을 지키는 불변식 테스트가 전부다.

**이 step은 TypeScript를 한 줄도 쓰지 않는다.** 라우트는 step 2·3이다.

왜 따로 떼어냈나: 마이그레이션과 라우트를 한 step에서 하면 SQL이 3회 실패했을 때 라우트까지 통째로 `error`가 되고, 무엇보다 **라우트가 RPC 시그니처를 추측하게 된다.** 계약이 먼저 있어야 그 위에 얹을 수 있다.

## 마이그레이션 번호는 `0008`이다 ← D-17

`supabase/migrations/`에 **0001~0007이 이미 있다.**

| 번호 | 파일 | 출처 |
|---|---|---|
| 0001~0004 | `schema` · `rls` · `storage` · `expiry_cron` | Phase 0 (PR #10) |
| 0005 | `grants` | PR #21 |
| 0006 | `upload_error_detail` | PR #26 |
| 0007 | `upload_recompute` | PR #39 |

**옛 계획 문서가 예약했던 `0005_polar_event_fn.sql`은 이미 `0005_grants.sql`이 쓰고 있다.**
`0008`을 쓴다. 다른 번호를 고르지 마라.

착수 전에 직접 확인하라:

```bash
ls supabase/migrations/ | tail -1     # 0007_upload_recompute.sql 이어야 한다
```

`0008`보다 큰 번호가 이미 있으면 그 다음 번호를 쓰고, **`phases/PLAN.md` D-17을 고쳐라.**

## 이전 Step과의 의존성

- **step 0 (`polar-client`)** — 직접 쓰는 것은 없다. 이 step은 SQL만 만진다
- **Phase 0 step 3 (`db-schema`)** — `profiles`(`plan`·`polar_customer_id`·`polar_subscription_id`·`source_modified_at`) · `webhook_events`(`event_id` pk) 테이블이 이미 있다. **테이블을 새로 만들지 마라**
- **`6-integrity` step 14 (`upload-recompute`)** — `0007_upload_recompute.sql`의 `replace_upload_result()`가 **이 step이 따를 형판이다.** security definer · 빈 `search_path` · `create or replace` 뒤의 `revoke` · `service_role`에만 `grant execute`

## 읽어야 할 파일

- `/supabase/migrations/0007_upload_recompute.sql` — **형판. 이 파일의 구조를 그대로 따라라**
- `/supabase/migrations/0005_grants.sql` — 권한 원칙. *"getProfilePlan() — plan 조회만. plan 갱신은 Phase 5 웹훅의 몫이라 아직 없다"* 가 이 step이 채우는 공백이다
- `/supabase/migrations/0001_schema.sql` — `profiles` · `webhook_events` 컬럼
- `/supabase/migrations/0002_rls.sql` — `webhook_events`는 RLS 활성 + 정책 0개(deny-all)다
- `/supabase/migrations.test.ts` — 불변식 테스트 형식. `describe("upload recompute")` 블록이 형판이다
- `/supabase/README.md` — 적용 순서
- `/docs/ADR.md` — **ADR-021 전문** · ADR-020 · ADR-008 · ADR-016
- `/docs/ARCHITECTURE.md` — §Polar 결제 · §Supabase 키 사용 규칙
- `/phases/PLAN.md` — **D-16 · D-17**

## 구현 범위

```
supabase/migrations/0008_polar_event_fn.sql   (신규)
supabase/migrations.test.ts                   (수정 — 불변식 추가)
```

### 함수 시그니처

```sql
create or replace function public.apply_polar_event(
  p_event_id          text,
  p_event_type        text,
  p_event_created_at  timestamptz,
  p_user_id           uuid,
  p_plan              text,          -- 'free' | 'pro'
  p_customer_id       text,
  p_subscription_id   text,
  p_modified_at       timestamptz
) returns text                       -- 'applied' | 'duplicate' | 'stale' | 'subscription_mismatch'
language plpgsql
security definer
set search_path = ''
as $$ … $$;
```

**반환 어휘 4개를 늘리지 마라.** step 3의 라우트가 이 값들로 분기한다.

### 함수 본문의 순서 — 이 순서가 멱등성의 전부다

1. `insert into public.webhook_events (event_id, event_type, event_created_at) values (…) on conflict (event_id) do nothing`
   → 삽입된 행이 0이면 **`duplicate`를 반환하고 끝낸다**
2. `select … from public.profiles where user_id = p_user_id for update` — **행을 잠근다**
3. 순서 역전 검사 2단:
   - `p_modified_at`이 저장된 `source_modified_at`보다 **오래되면** → `stale` 반환
   - `polar_subscription_id`가 `null`이 **아니고** `p_subscription_id`와 다르면 → `subscription_mismatch` 반환
4. 통과하면 `plan` · `polar_customer_id` · `polar_subscription_id` · `source_modified_at` 갱신 → `applied`

**1번이 먼저인 것이 핵심이다.** 같은 transaction 안이므로 4번이 실패하면 1번도 롤백된다.
`stale`·`subscription_mismatch`로 끝나도 **1번의 기록은 남는다** — 재전송이 다시 처리되지 않게 하려는 것이다.

### 권한 블록 ← D-16

```sql
-- create or replace 는 EXECUTE 를 PUBLIC 에 자동으로 준다. 회수가 반드시 뒤에 와야 하고,
-- 순서를 뒤집으면 PostgREST 의 /rest/v1/rpc/ 로 미로그인 호출이 열린다.
revoke execute on function public.apply_polar_event(text, text, timestamptz, uuid, text, text, text, timestamptz)
  from public, anon, authenticated;

grant execute on function public.apply_polar_event(text, text, timestamptz, uuid, text, text, text, timestamptz)
  to service_role;
```

**`grant update on public.profiles to service_role`을 쓰지 마라.** D-16의 결정이다:
함수가 `security definer`라 소유자 권한으로 돌기 때문에 롤 권한이 필요 없고,
UPDATE를 열어 주면 **`apply_polar_event` 밖에서도 `plan`을 바꿀 수 있게 되어 ADR-020의
"유일한 경로"가 규율 문제로 내려앉는다.** 지금은 타입이 아니라 권한이 막고 있다.

`webhook_events`에도 GRANT를 주지 마라 — 같은 이유다.

## 먼저 작성할 테스트

`supabase/migrations.test.ts`에 `describe("polar billing")` 블록을 추가한다. 기존
`describe("upload recompute")`가 그대로 형판이다 — **SQL을 텍스트로 읽어 검사한다. DB가 필요 없다.**

### 원자성 ← ADR-021 (게이트 G1)
1. `apply_polar_event` 함수 본문에 `webhook_events`에 대한 **INSERT가 있다**
2. 같은 본문에 `profiles`에 대한 **UPDATE가 있다**
3. **둘이 같은 함수 본문 안에 있다** — 두 개의 별도 함수로 쪼개지지 않았다

### 데이터를 건드리지 않는다 ← ADR-008 (게이트 G2)
4. 함수 본문에 `uploads`에 대한 DELETE/UPDATE/INSERT가 **없다**
5. 함수 본문에 `transactions`에 대한 DELETE/UPDATE/INSERT가 **없다**

### 권한 최소화 ← D-16 (게이트 G5)
6. 함수가 `security definer`다
7. `set search_path = ''`가 있다
8. `revoke execute`가 `create or replace function` **뒤에** 온다 (문자열 인덱스 비교)
9. `revoke`의 대상이 `public, anon, authenticated`를 전부 포함한다
10. `grant execute`의 대상이 `service_role`**만**이다 — `anon`·`authenticated`·`public`이 없다
11. **`0008`이 `profiles`에 `grant update`를 하지 않는다** ← D-16
12. **`0008`이 `webhook_events`에 어떤 GRANT도 하지 않는다**

### 일반화 — 앞으로의 모든 함수에 적용 (게이트 G5)
13. **모든 마이그레이션 파일을 훑어, `security definer` 함수마다 `revoke execute`가 뒤따르는지 검사한다.** `replace_upload_result`·`apply_polar_event`·기존 트리거 함수 2개가 전부 걸린다.
    이 테스트 하나가 앞으로 추가될 함수까지 자동으로 덮는다 — 이것이 `supabase-safe-migration` skill을 만들지 않기로 한 근거다(PLAN.md §skill 판단)

### 기존 불변식 유지
14. `subscriptions` 테이블을 만들지 않는다 (기존 테스트 유지 — 게이트 G6)
15. `DROP TABLE`이 없다 (기존 테스트 유지)
16. 마이그레이션 번호가 **연속**이고 중복이 없다 ← `0005` 충돌 재발 방지

## Codex 실행 지시문

### 테이블을 만들지 마라

`profiles`(컬럼 4개 전부) · `webhook_events`는 **Phase 0의 `0001_schema.sql`에 이미 있다.**
`alter table ... add column`도 필요 없다. 이 마이그레이션은 **함수 하나와 권한뿐**이다.

확인:

```bash
grep -n "polar_customer_id\|polar_subscription_id\|source_modified_at" supabase/migrations/0001_schema.sql
grep -n "webhook_events" supabase/migrations/0001_schema.sql
```

### 재실행 안전 (멱등)

`create or replace` · `on conflict do nothing` · `grant`/`revoke`는 전부 멱등이다.
0005·0006·0007이 전부 이 성질을 주석으로 명시했다. **같은 주석을 남겨라** — 사람이 SQL Editor에서 두 번 붙여 넣는 일이 실제로 일어난다.

### `DROP` 금지

`bash-guard.mjs`가 `DROP TABLE`을 차단한다. `drop function`도 쓰지 마라 — `create or replace`로 충분하고, drop은 의존하는 권한을 함께 날린다.

### 파일 상단 주석

0005·0006·0007이 전부 **「문제 → 원칙 → 재실행 안전」** 형식의 주석을 갖고 있다. 같은 형식으로 써라. 특히 남겨야 할 것:

- 왜 plpgsql 함수인가 — Supabase JS 클라이언트는 여러 문장을 하나의 transaction으로 묶지 못한다(ADR-021)
- 왜 `service_role`에 `profiles` UPDATE를 주지 않는가 — D-16
- 반환 어휘 4개의 의미

### 기존 마이그레이션을 고치지 마라

`0001`~`0007`은 **live DB에 이미 적용됐다.** 파일을 고치면 파일과 DB가 갈린다. 새 파일만 추가하라.

## 완료 조건

- `supabase/migrations/0008_polar_event_fn.sql`이 존재한다 (**`0005`가 아니다**)
- `apply_polar_event`가 위 시그니처·반환 어휘 4개를 그대로 갖는다
- 함수 안에서 `webhook_events` INSERT와 `profiles` UPDATE가 **함께** 일어난다
- `security definer` + `set search_path = ''`
- `revoke`가 `create or replace` 뒤에 오고, `grant execute`는 `service_role`에만
- **`profiles`에 `grant update`가 없다**
- `uploads`·`transactions`를 언급하지 않는다
- `migrations.test.ts`에 16개 항목이 추가되고 전부 통과한다
- **TypeScript 파일을 하나도 만들지 않았다** (`migrations.test.ts` 수정 제외)
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run supabase/migrations.test.ts
```

직접 확인:

```bash
ls supabase/migrations/0008_polar_event_fn.sql || echo "FAIL: 번호가 틀렸다"
ls supabase/migrations/0005_polar_event_fn.sql 2>/dev/null && echo "FAIL: 0005 는 grants 다" || echo "OK"
grep -c "0005_grants.sql" supabase/README.md    # 1 이상이어야 한다

grep -n "security definer" supabase/migrations/0008_polar_event_fn.sql || echo "FAIL"
grep -n "search_path" supabase/migrations/0008_polar_event_fn.sql || echo "FAIL"
grep -nE "grant .*update.* on .*profiles" supabase/migrations/0008_polar_event_fn.sql && echo "FAIL: D-16 위반" || echo "OK"
grep -nE "uploads|transactions" supabase/migrations/0008_polar_event_fn.sql && echo "FAIL: ADR-008 위반" || echo "OK"
grep -niE "drop (table|function)" supabase/migrations/0008_polar_event_fn.sql && echo "FAIL" || echo "OK"

# revoke 가 create 뒤인지 (행 번호 비교)
grep -n "create or replace function public.apply_polar_event" supabase/migrations/0008_polar_event_fn.sql
grep -n "revoke execute on function public.apply_polar_event" supabase/migrations/0008_polar_event_fn.sql

# 이 step 은 TS 를 만들지 않는다
git status --porcelain src/ | grep . && echo "FAIL: src/ 를 건드렸다" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ADR-021 (G1) — INSERT와 UPDATE가 한 함수 안에 있는가? `subscriptions` 테이블이 없는가(G6)?
   - ADR-008 (G2) — `uploads`·`transactions`를 언급하지 않는가?
   - D-16 (G5) — `security definer` + EXECUTE만? `profiles` UPDATE grant가 없는가?
   - D-17 — 번호가 `0008`인가?
   - AGENTS.md — `DROP TABLE`이 없는가? 새 함수의 GRANT를 같은 마이그레이션에 넣었는가?
3. 결과에 따라 `phases/5-billing/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄. **RPC 인자 순서와 반환 어휘를 반드시 적어라 — step 3이 이걸 읽는다** (예: "migrations/0008_polar_event_fn.sql — apply_polar_event(p_event_id text, p_event_type text, p_event_created_at timestamptz, p_user_id uuid, p_plan text, p_customer_id text, p_subscription_id text, p_modified_at timestamptz) returns text: applied|duplicate|stale|subscription_mismatch. webhook_events on conflict do nothing → profiles for update → 2단 검사 → 갱신, 전부 한 함수. security definer + search_path='' + revoke 후 service_role EXECUTE만(profiles UPDATE grant 없음). migrations.test.ts 에 불변식 16개 추가")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. **`summary`에 「`0008`을 live DB에 적용해야 한다 — 적용 전에는 웹훅 URL을 Polar에 등록하지 마라」를 반드시 덧붙여라.** 순서가 뒤집히면 Polar가 없는 함수로 이벤트를 보내고 재전송 끝에 유실된다.

## commit 기준

`feat(5-billing): step 1 — billing-schema`

포함: `supabase/migrations/0008_polar_event_fn.sql` · `supabase/migrations.test.ts`

## 금지사항

- **`0005`·`0006`·`0007` 번호를 재사용하지 마라.** 이유: 이미 존재하고 live DB에 적용됐다. 옛 계획서가 `0005`를 예약했지만 그건 `0005_grants.sql`이 가져갔다(D-17).
- **기존 마이그레이션 파일을 수정하지 마라.** 이유: live DB에 적용된 것과 파일이 갈린다.
- **`profiles`·`webhook_events` 테이블을 새로 만들거나 컬럼을 추가하지 마라.** 이유: `0001_schema.sql`에 4개 컬럼이 전부 있다.
- **`grant update on public.profiles to service_role`을 쓰지 마라.** 이유: `security definer`라 필요 없고, 열어 주면 `apply_polar_event` 밖에서도 `plan`을 바꿀 수 있어 ADR-020의 "유일한 경로"가 무너진다(D-16).
- **`webhook_events` INSERT와 `profiles` UPDATE를 두 함수로 쪼개지 마라.** 이유: 크래시 시 이벤트가 처리됨으로 기록된 채 반영되지 않고, 재전송마저 멱등 검사에 걸려 버려진다(ADR-021).
- **함수에서 `uploads`·`transactions`를 건드리지 마라.** 이유: 구독 종료는 화면만 잠근다(ADR-008).
- **`subscriptions` 테이블을 만들지 마라.** 이유: 앱이 묻는 질문은 "Pro인가" 하나다(ADR-021).
- **`revoke`를 `create or replace` 앞에 두지 마라.** 이유: `create or replace`가 EXECUTE를 PUBLIC에 다시 준다. 0007 주석이 같은 함정을 기록했다.
- **`DROP TABLE`·`drop function`을 쓰지 마라.**
- **라우트·서비스 등 TypeScript 구현을 만들지 마라.** 이유: step 2·3이다. 이 step은 DB 계약만 굳힌다.
- **이 step에서 DB에 직접 적용하려 하지 마라.** 이유: SQL 파일을 커밋하는 데서 끝난다(PLAN.md D-8). 적용은 사람이 한다 — 적용 못 했다고 `blocked` 처리하지 마라.
- 기존 테스트를 깨뜨리지 마라.
