# Supabase 설정

이 디렉터리는 실행 가능한 마이그레이션 SQL만 제공한다. 하네스는 SQL 파일을 커밋하는 데서
끝나고(`phases/PLAN.md` D-8), **적용은 프로젝트 관리자가 아래 순서대로 한다.**

## 마이그레이션 적용

Supabase Dashboard의 SQL Editor에서 다음 파일을 번호 순서대로 실행한다.

| # | 파일 | 상태 | 무엇 |
|---|---|---|---|
| 1 | `migrations/0001_schema.sql` | **적용됨** | 테이블 6 · 인덱스 · auth 트리거 |
| 2 | `migrations/0002_rls.sql` | **적용됨** | RLS 활성 · 정책 |
| 3 | `migrations/0003_storage.sql` | **적용됨** | 비공개 `csv-uploads` 버킷 · Storage 정책 |
| 4 | `migrations/0004_expiry_cron.sql` | **적용됨** | 90일 만료 pg_cron |
| 5 | `migrations/0005_grants.sql` | **적용됨** | 테이블 GRANT. **`0001`~`0004`에 통째로 빠져 있었다** — 모든 롤이 42501, `uploads` 0행 |
| 6 | `migrations/0006_upload_error_detail.sql` | **적용됨** | 실패 원인 상세 컬럼 |
| 7 | `migrations/0007_upload_recompute.sql` | **적용됨** | `replace_upload_result()` — delete→insert→update 원자화 |
| 8 | `migrations/0008_polar_event_fn.sql` | **미작성** | `apply_polar_event()` — Phase 5 step 1이 만든다 |

Supabase CLI가 연결된 환경에서는 프로젝트 루트에서 다음 명령으로 같은 순서를 적용할 수 있다.

```sh
supabase db push
```

### `0008` 적용 순서 주의

**`0008`을 적용하기 전에 Polar dashboard에 웹훅 URL을 등록하지 마라.** RPC가 없으니 웹훅이
500을 반환하고, Polar의 재전송 상한이 소진되면 그 이벤트는 영원히 잃는다.
순서는 `phases/PLAN.md` §Phase 5 시작 게이트 → DB 게이트 참고.

적용 확인:

```sql
select proname from pg_proc where proname = 'apply_polar_event';
-- EXECUTE 가 service_role 에만 있는지
\df+ public.apply_polar_event
```

## 새 마이그레이션 체크리스트

새 `.sql`을 추가할 때 아래를 전부 확인한다. **하나라도 빠지면 조용히 깨진다** —
`0005`가 나온 이유가 정확히 GRANT 누락이었고, SQL 파일만 봐서는 알 수 없었다.

- [ ] **번호**: `ls supabase/migrations | tail -1`의 **다음** 번호. 계획 문서에 적힌 번호를
      믿지 마라 — Phase 5가 예약했던 `0005`를 `0005_grants.sql`이 이미 가져갔다
- [ ] **기존 파일을 고치지 않았다.** `0001`~`0007`은 live DB에 적용됐다. 고치면 파일과 DB가 갈린다
- [ ] **멱등**: `if not exists` · `create or replace` · `on conflict do nothing` ·
      `grant`/`revoke`. 사람이 SQL Editor에서 두 번 붙여 넣는 일이 실제로 일어난다
- [ ] **새 테이블·함수에 GRANT를 같은 파일 안에서 준다.** `0005`의 GRANT는 테이블 단위라
      새 컬럼은 상속되지만 **새 테이블·함수는 상속되지 않는다.** RLS 정책은 "어느 행"이고,
      그 이전에 "이 롤이 이 테이블을 건드릴 수 있나"(GRANT)가 통과해야 한다
- [ ] **`create or replace function` 뒤에 `revoke execute ... from public, anon, authenticated`.**
      `create or replace`가 EXECUTE를 PUBLIC에 자동으로 준다 — 순서를 뒤집으면 PostgREST의
      `/rest/v1/rpc/<fn>`으로 미로그인 호출이 열린다. 그다음 필요한 롤에만 `grant execute`
- [ ] **`security definer` 함수는 `set search_path = ''`**
- [ ] **`DROP TABLE`·`drop function` 없음** (`bash-guard.mjs`가 `DROP TABLE`을 차단한다)
- [ ] **코드가 실제로 쓰는 동사에만 권한을 준다.** 정책이 없는 곳에 권한을 주지 않고,
      정책이 있는 곳에도 코드가 쓰지 않는 동사는 주지 않는다
- [ ] **파일 상단에 「문제 → 원칙 → 재실행 안전」 주석.** `0005`·`0006`·`0007`이 전부 이 형식이다
- [ ] **`supabase/migrations.test.ts`에 불변식을 추가했다.** SQL을 텍스트로 읽어 검사하므로
      DB 없이 돈다. 이게 이 레포에서 마이그레이션 회귀를 막는 유일한 자동 장치다
- [ ] **위 표에 행을 추가했다**

## 콘솔 설정

- Authentication > Providers에서 Google provider를 활성화한다.
- Google OAuth 앱과 Supabase URL Configuration 양쪽에 실제 배포 도메인의
  `https://<domain>/auth/callback`을 redirect URL로 등록한다. 로컬 개발 시
  `http://localhost:3000/auth/callback`도 등록한다.
- Database > Extensions에서 `pg_cron`을 활성화해야 할 수 있다. 확장 권한 문제로
  `0004_expiry_cron.sql` 적용이 실패하면 Dashboard에서 확장을 먼저 활성화한 뒤 다시 실행한다.

## 90일 만료 잡 수동 확인

`0004_expiry_cron.sql`은 만료된 `csv-uploads`의 `storage.objects` 행을 지우고
`uploads.storage_path`를 `null`로 만든다. `transactions`와 `uploads.summary`는 유지한다.

**프로젝트 설정에 따라 `storage.objects` 행을 SQL로 삭제했을 때 실제 오브젝트 스토리지의
바이트까지 파기되는지 다를 수 있다. Supabase 콘솔에서 만료 테스트 객체를 만든 뒤 잡을
실행하고, Storage 화면에서 실제 객체가 사라졌는지 반드시 눈으로 확인한다.** 실제 바이트가
남는 환경이면 SQL 행 삭제만으로 운영하지 말고 Supabase가 지원하는 Storage 삭제 경로를
별도로 구성한 뒤 개인정보처리방침의 90일 파기 약속을 검증한다.
