# Step 3: db-schema

## 목적

ARCHITECTURE.md §DB 스키마를 그대로 실행 가능한 마이그레이션 SQL로 옮긴다.
테이블 6개 · 인덱스 · RLS 정책 · Storage 버킷 정책 · 90일 만료 `pg_cron` 잡.

**DB에 적용하는 것은 이 step의 일이 아니다.** SQL 파일을 커밋하는 데서 끝난다.

## 이전 Step과의 의존성

- **step 2 (`core-types`)** — `VERDICTS`(3) · `UPLOAD_STATUSES`(3) · `ACCOUNT_CODES`(18)의 값이 SQL `check` 제약과 **정확히 일치해야 한다.** 타입 파일을 먼저 읽어라.

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §DB 스키마 **전문** · §RLS 경계 · §Storage · §삭제 정합성 · §90일 만료
- `/docs/ADR.md` — ADR-005(90일·pg_cron) · ADR-015(transactions) · ADR-016(Supabase) · ADR-021(구독 테이블 없음)
- `/docs/PRD.md` — §데이터 처리 원칙
- `/src/types/transaction.ts` · `/src/types/upload.ts` · `/src/types/account-codes.ts` — check 제약에 넣을 값
- `/scripts/hooks/bash-guard.mjs` — `DROP TABLE`이 어떻게 차단되는지
- `/phases/PLAN.md` — **D-8(마이그레이션은 SQL까지, 적용은 사람이)**

## 구현 범위

```
supabase/migrations/0001_schema.sql       테이블 6개 + 인덱스 + check 제약
supabase/migrations/0002_rls.sql          RLS 활성화 + 정책
supabase/migrations/0003_storage.sql      csv-uploads 버킷 + 정책
supabase/migrations/0004_expiry_cron.sql  90일 만료 pg_cron 잡
supabase/README.md                        적용 방법 (사람이 읽는다)
supabase/migrations.test.ts               SQL 텍스트 불변식 검사
```

## 수정 대상 파일

위 6개. 전부 신규. `src/` 아래는 건드리지 않는다.

## 먼저 작성할 테스트

`supabase/migrations.test.ts` — **DB 없이** 마이그레이션 SQL을 텍스트로 읽어 불변식을 검사한다.

> 이 테스트가 진짜로 하는 일: 나중에 누군가 스키마를 "개선"하다 문서가 명시적으로 금지한 것을 되살리는 걸 막는다. DB 연결이 필요 없으므로 CI·Stop 훅에서 항상 돈다.

검사 항목:

1. `supabase/migrations/` 아래 `.sql` 파일이 4개 이상이고 파일명이 `NNNN_` 접두사로 정렬된다
2. **어떤 파일에도 `DROP TABLE`이 없다** (대소문자 무시)
3. `transactions` 정의에 카드번호·승인번호에 해당하는 컬럼이 없다 — `card_number`·`card_no`·`approval` 패턴 부재
4. `merchant_dictionary`와 `csv_format_mappings` 정의에 `user_id`·`auth.users` 참조가 없다 (전역 공유 자산이므로 사용자 식별자를 넣으면 전제가 깨진다)
5. `uploads`에 `unique` 인덱스 `(user_id, file_hash)`가 있다
6. `profiles` · `uploads` · `transactions` 세 테이블에 `enable row level security`가 걸려 있다
7. `merchant_dictionary` · `csv_format_mappings`에는 RLS **정책이 없다** (읽기 공개)
8. `subscriptions`라는 이름의 테이블이 없다 (ADR-021)
9. `verdict` check 값 집합이 `src/types/transaction.ts`의 `VERDICTS`와 같다
10. `uploads.status` check 값 집합이 `UPLOAD_STATUSES`와 같다
11. `storage_path`에 `{user_id}/` 접두사를 요구하는 제약 또는 주석이 있다

9·10번은 **타입 파일을 실제로 import해서** 비교하라. 문자열을 다시 적으면 그게 어긋남의 시작점이 된다.

## Codex 실행 지시문

### `0001_schema.sql`

ARCHITECTURE.md §DB 스키마의 DDL을 그대로 옮긴다. 문서에 있는 것을 **더하지도 빼지도 마라.**

- `profiles(user_id pk → auth.users, email, plan default 'free' check(plan in ('free','pro')), polar_customer_id unique, polar_subscription_id, source_modified_at, created_at)`
- `uploads(...)` — `status` check 3값, `retry_count int not null default 0`, `expires_at timestamptz not null`, `summary jsonb`
- `transactions(...)` — `verdict` check 3값, `amount bigint`(취소는 음수), `account_code text`
- `merchant_dictionary(merchant_key pk, account_code, default_verdict, reason, created_at, updated_at)`
- `csv_format_mappings(header_fingerprint pk, column_map jsonb, header_row_index int, encoding, created_at)`
- `webhook_events(event_id pk, event_type, event_created_at, processed_at)`

인덱스 4개:
```sql
create index on uploads (user_id, created_at desc);
create unique index on uploads (user_id, file_hash);
create index on uploads (expires_at) where status <> 'failed';
create index on transactions (upload_id, row_index);
```

`transactions.upload_id`는 `references uploads on delete cascade`.

`merchant_dictionary.account_code`에 18개 고정 목록 check 제약을 걸어라. **이유**: 모델 응답이 전역 사전에 그대로 들어가는 것을 DB 층에서도 한 번 더 막는다(AGENTS.md — 전역 자산이라 오염이 전 사용자에게 전파된다). 애플리케이션 검증만으로는 경로가 하나 늘어날 때마다 뚫린다.

`merchant_dictionary.default_verdict`는 `expense | personal`만 허용한다 — `uncertain`은 사전에 저장하는 값이 아니라 "사전에 없다"의 결과다.

**`DROP TABLE`을 쓰지 마라.** PreToolUse 훅(`bash-guard.mjs`)이 차단하고, 되돌릴 수 없는 파괴다. 마이그레이션은 전부 `create ... if not exists` 형태로 앞으로만 간다.

**`subscriptions` 테이블을 만들지 마라**(ADR-021). 앱이 묻는 질문은 "이 사용자가 Pro인가" 하나뿐이고 답은 `profiles.plan`이다.

`auth.users` INSERT 시 `profiles` 행을 만드는 트리거를 하나 둔다 — 없으면 첫 로그인 사용자에게 `plan`을 물을 곳이 없다.

### `0002_rls.sql`

- `profiles` · `uploads` · `transactions`: `enable row level security` + `auth.uid()` 기반 select/insert/update/delete 정책
- `merchant_dictionary` · `csv_format_mappings`: **RLS를 켜지 마라.** 전역 공유 자산이고 읽기 공개다(ARCHITECTURE.md §RLS 경계). 쓰기는 service role만 하므로 RLS 없이도 anon 키로는 못 쓴다 — 대신 `grant`를 명시해 anon에 `select`만 준다.
- `webhook_events`: 사용자 컨텍스트가 없다. RLS를 켜고 정책을 두지 않으면 service role만 접근한다.

> **타인의 업로드는 403이 아니라 404다**(ARCHITECTURE.md). 이건 RLS가 아니라 라우트가 만드는 동작이고 Phase 2에서 처리한다. 여기서는 RLS가 행을 안 보이게 하는 것까지가 전부다.

### `0003_storage.sql`

버킷 `csv-uploads`를 **비공개**로 만들고, 소유자만 read/insert/delete하는 정책을 건다.

표준 정책이 **경로 첫 세그먼트를 소유자로 본다** — `(storage.foldername(name))[1] = auth.uid()::text`. 그래서 `storage_path`가 반드시 `{user_id}/{upload_id}.csv`여야 한다. **평평한 경로로 저장하면 이 정책을 못 쓴다**(ARCHITECTURE.md §Storage).

### `0004_expiry_cron.sql`

`pg_cron`으로 하루 1회 도는 잡. Vercel 쪽에는 크론이 없고, 앱 요청에 얹는 lazy expiry는 돌아오지 않는 사용자의 데이터를 영원히 남긴다(ADR-005).

잡이 하는 일:
- `expires_at < now()`이고 `storage_path is not null`인 `uploads`를 찾는다
- 해당 **Storage 객체만** 파기하고 `uploads.storage_path`를 `null`로 만든다
- **`transactions`와 `summary`는 남긴다.** 사용자가 잃는 것은 원본 파일과 재시도 가능성이지 리포트가 아니다

`create extension if not exists pg_cron;`을 앞에 둔다.

> **주의 — 여기는 수동 검증이 필요하다.** Supabase에서 `storage.objects` 행을 SQL로 지웠을 때 실제 오브젝트 스토리지의 바이트까지 정리되는지는 프로젝트 설정에 따라 다르다. SQL은 문서대로 작성하되, `supabase/README.md`에 **"이 잡은 Supabase 콘솔에서 실제 객체 파기 여부를 반드시 눈으로 확인해야 한다"**고 적어라. 확인하지 못했다고 이 step을 `blocked` 처리하지 마라 — 사람이 할 일이다.

### `supabase/README.md`

사람이 읽는 문서. 다음을 적는다:
- 마이그레이션 적용 순서와 명령 (Supabase 콘솔 SQL Editor 또는 `supabase db push`)
- Google OAuth provider를 콘솔에서 켜야 한다는 것 (redirect URL 포함)
- `pg_cron` 확장 활성화가 콘솔에서 필요할 수 있다는 것
- **0004 잡의 실제 객체 파기 여부를 수동 확인해야 한다**는 경고

## 완료 조건

- SQL 파일 4개 + README + 테스트가 존재한다
- `migrations.test.ts` 11개 항목이 전부 통과한다
- 어떤 SQL에도 `DROP TABLE`이 없다
- `subscriptions` 테이블이 없다
- `merchant_dictionary`·`csv_format_mappings`에 사용자 식별자가 없다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run supabase/migrations.test.ts
```

직접 확인:

```bash
grep -riE "drop\s+table" supabase/ && echo "FAIL" || echo "OK: DROP TABLE 없음"
grep -rn "create table" supabase/migrations/ | grep -i subscription && echo "FAIL" || echo "OK: subscriptions 없음"
```

> `npx vitest run supabase/...`가 "No test files found"로 나오면 step 0의 `vitest.config.ts` `include`에 `supabase/**/*.test.ts`가 빠진 것이다. 그 설정을 고쳐라.

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §DB 스키마의 테이블·컬럼·인덱스와 1:1인가? (더한 것도 뺀 것도 없는가)
   - ADR-021 — `subscriptions` 테이블을 만들지 않았는가?
   - ADR-015 / AGENTS.md CRITICAL — 카드번호·승인번호 컬럼이 없는가?
   - RLS 경계 — 전역 사전 2개 테이블에 사용자 식별자가 없는가?
   - Storage 경로가 `{user_id}/` 접두사를 전제하는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "supabase/migrations 0001~0004: 테이블 6개·인덱스 4개·RLS(profiles/uploads/transactions)·csv-uploads 비공개 버킷({user_id}/ 접두사 정책)·pg_cron 90일 만료. migrations.test.ts 11항목. **DB 적용은 미실시 — 사람이 콘솔에서 해야 함**")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - **DB 적용 불가는 `blocked` 사유가 아니다.** SQL 파일이 커밋되면 `completed`다
4. `summary`에 "DB 적용은 사람이 해야 한다"는 사실을 반드시 남겨라 — 다음 step들이 이 문맥을 읽는다.

## commit 기준

`feat(0-foundation): step 3 — db-schema`

포함: `supabase/**`

## 금지사항

- **`DROP TABLE`을 쓰지 마라.** 이유: PreToolUse 훅이 차단하고, 되돌릴 수 없는 파괴다.
- **`subscriptions` 테이블을 만들지 마라.** 이유: 앱이 묻는 질문은 "Pro인가" 하나이고 결제수단·영수증·청구일은 Polar Customer Portal에 위임했다(ADR-021).
- **`merchant_dictionary`·`csv_format_mappings`에 `user_id`를 넣지 마라.** 이유: 이 둘이 RLS 예외인 근거가 "개인정보를 담지 않는다"는 전제인데, 사용자 식별자를 넣는 순간 전제가 깨진다.
- **`transactions`에 카드번호·승인번호 컬럼을 만들지 마라.** 이유: 정규화 단계에서 제거하기로 했고, 컬럼이 있으면 언젠가 채워진다(ADR-015).
- **`uncertain_count`·`duplicate_count` 같은 비정규화 카운트 컬럼을 만들지 마라.** 이유: MVP 규모에서 `transactions` 집계로 충분하고, 두면 갱신 누락으로 조용히 틀어진다(ADR 미룬 것 표).
- **거래 지문 컬럼·`is_duplicate` 플래그를 만들지 마라.** 이유: 리포트가 업로드 1건 단위라 합산이 없고, 합산이 없으면 중복 계상이 생기지 않는다(ADR-014).
- **Storage 경로를 평평하게 두지 마라.** 이유: 표준 정책이 경로 첫 세그먼트를 소유자로 보므로 `{user_id}/` 접두사가 정책의 전제조건이다.
- **`src/` 아래 코드를 수정하지 마라** — 이 step은 SQL과 그 검사 테스트만 다룬다.
- 기존 테스트를 깨뜨리지 마라.
