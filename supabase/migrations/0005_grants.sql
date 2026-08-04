-- 0005_grants.sql — 테이블 권한(GRANT) 부여
--
-- 문제: 0001~0004 는 테이블·RLS 정책·Storage·cron 을 만들었지만 **테이블 권한을
-- 한 번도 부여하지 않았다**. RLS 정책은 "어느 행을 볼 수 있나"를 정할 뿐이고,
-- 그 이전에 "이 롤이 이 테이블을 건드릴 수 있나"(GRANT)가 통과해야 한다.
-- 그래서 모든 롤이 모든 테이블에서 42501 permission denied 를 맞고 있었다.
-- 실제 증상: uploads 0행 — 업로드가 한 번도 성공한 적이 없다.
--
-- 원칙: 코드가 실제로 수행하는 연산에만 권한을 준다. 정책이 없는 곳에 권한을
-- 주지 않고, 정책이 있는 곳에도 코드가 쓰지 않는 동사는 주지 않는다.
--
-- 재실행 안전: GRANT/REVOKE 는 멱등이다.

-- ---------------------------------------------------------------------------
-- 1. 스키마 사용 권한
-- ---------------------------------------------------------------------------
-- 테이블 권한이 있어도 스키마 USAGE 가 없으면 접근할 수 없다.
grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. service_role — 서버 전용 경로(src/lib/supabase/service.ts 등)가 쓰는 것만
-- ---------------------------------------------------------------------------
-- service_role 은 RLS 를 우회한다. 그래서 "이 롤이 무엇을 할 수 있나"가 유일한
-- 방어선이며, 헬퍼가 userId 를 필수 첫 인자로 받는 시그니처가 그 위에 얹힌다.

-- getProfilePlan() — plan 조회만. plan 갱신은 Phase 5 웹훅의 몫이라 아직 없다.
grant select on public.profiles to service_role;

-- getUploadForUser() / updateUploadForUser() / claimUploadRetry()
-- INSERT 는 사용자 요청 경로(authenticated)가 하고, DELETE 도 그쪽이 한다.
grant select, update on public.uploads to service_role;

-- insertTransactionsForUser() / deleteTransactionsForUser()
-- 재시도 시 기존 행을 지우고 다시 넣는다. UPDATE 는 쓰지 않는다.
grant select, insert, delete on public.transactions to service_role;

-- 전역 사전 — dictionary.ts / run-analysis.ts 의 upsert (= INSERT + UPDATE)
grant select, insert, update on public.merchant_dictionary to service_role;
grant select, insert, update on public.csv_format_mappings to service_role;

-- transactions.id 는 bigserial 이다. INSERT 하려면 시퀀스 USAGE 가 필요하다.
grant usage on sequence public.transactions_id_seq to service_role;

-- ---------------------------------------------------------------------------
-- 3. authenticated — 0002 의 RLS 정책이 이미 정의한 범위 안에서만
-- ---------------------------------------------------------------------------
-- 아래 권한을 줘도 RLS 가 "자기 행만"으로 다시 좁힌다. 권한과 정책이 둘 다
-- 통과해야 하므로, 정책 범위를 넓히는 것이 아니라 정책이 작동하게 만드는 것이다.

-- SELECT  : dashboard/page.tsx 목록, GET /api/uploads
-- INSERT  : POST /api/uploads (접수 행 생성 — 사용자 컨텍스트에서 한다)
-- DELETE  : DELETE /api/uploads/[id]
-- UPDATE 는 주지 않는다. 상태 전이는 전부 service_role 이 한다.
grant select, insert, delete on public.uploads to authenticated;

-- SELECT 만. 거래 행 생성·삭제는 전부 service_role 이 한다.
grant select on public.transactions to authenticated;

-- profiles 에는 주지 않는다. 사용자 컨텍스트로 profiles 를 읽는 코드가 없고
-- (plan 조회는 service_role 의 getProfilePlan), 행 생성은 auth 트리거가 한다.

-- ---------------------------------------------------------------------------
-- 4. anon — 새 권한 없음
-- ---------------------------------------------------------------------------
-- 0002 가 준 전역 사전 SELECT 가 전부다. 익명 업로드는 없다(ADR-006).

-- ---------------------------------------------------------------------------
-- 5. SECURITY DEFINER 함수의 불필요한 노출 차단
-- ---------------------------------------------------------------------------
-- 둘 다 SECURITY DEFINER 인데 EXECUTE 가 PUBLIC 에 열려 있어, PostgREST 의
-- /rest/v1/rpc/<fn> 으로 미로그인 사용자도 호출할 수 있다.
--
-- 트리거 함수는 트리거가 발동할 때 EXECUTE 권한을 검사하지 않는다. 따라서
-- 회수해도 아래 두 트리거는 그대로 동작한다:
--   - on_auth_user_created (auth.users 행 트리거) → handle_new_auth_user()
--   - ensure_rls (ddl_command_end 이벤트 트리거)  → rls_auto_enable()
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
