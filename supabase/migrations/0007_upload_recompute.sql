-- 0007_upload_recompute.sql — completed 업로드의 재계산
--
-- 문제: 분석 로직이 바뀌어도 이미 completed 인 업로드는 옛 결과를 그대로 들고 있다
-- (#30). retry 는 failed 전용이라 쓸 수 없고, 사용자 화면에는 낡은 절감액이 계속
-- 보인다. 실제 증상: #25 로 취소 거래 정책이 바뀌었는데 기존 명세서는 취소 19건이
-- 양수로 합산된 채 남아 있다.
--
-- 원자성: 재계산은 거래 행을 지우고 다시 넣는다. 삭제만 커밋되고 삽입이 실패하면
-- 사용자는 멀쩡했던 보고서를 잃는다. delete → insert → uploads update 를 한
-- plpgsql 함수에 넣으면, 함수 호출이 하나의 문장이라 암묵적 트랜잭션 안에서 돌고
-- 중간의 raise 가 전부 롤백한다.
--
-- 잠금: recompute_started_at 은 진행 중인 재계산의 선점 표시다. 15분이 지나면
-- 죽은 잠금으로 보고 다시 걸 수 있다 — 비교-교환 조건은 앱(claimUploadRecompute)이
-- 건다. 이 마이그레이션은 컬럼과 해제 시점만 정의한다.
--
-- 재실행 안전: if not exists · create or replace · GRANT/REVOKE 전부 멱등이다.

alter table public.uploads
  add column if not exists recompute_started_at timestamptz;

alter table public.uploads
  add column if not exists recomputed_at timestamptz;

comment on column public.uploads.recompute_started_at is
  '진행 중인 재계산의 선점 시각. 15분이 지나면 잠금이 풀린 것으로 본다. 끝나면 null 로 되돌린다.';

comment on column public.uploads.recomputed_at is
  '마지막 재계산 성공 시각. 최초 분석만 거친 업로드는 null 이다.';

-- ---------------------------------------------------------------------------
-- replace_upload_result — 성공한 재계산 결과로 기존 결과를 원자적으로 교체
-- ---------------------------------------------------------------------------
create or replace function public.replace_upload_result(
  p_user_id uuid,
  p_upload_id uuid,
  p_transactions jsonb,
  p_summary jsonb,
  p_period_start date,
  p_period_end date,
  p_row_count int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER 는 RLS 를 우회한다. 소유자 필터가 유일한 방어선이므로
  -- 행을 건드리는 모든 문장에 p_user_id 를 직접 건다.
  delete from public.transactions
   where user_id = p_user_id
     and upload_id = p_upload_id;

  -- 소유권은 인자에서만 온다. 행 payload 에 user_id 를 실으면 남의 업로드에
  -- 거래를 꽂을 수 있는 자리가 생긴다.
  insert into public.transactions
    (user_id, upload_id, row_index, txn_date, merchant, amount, account_code, verdict)
  select
    p_user_id,
    p_upload_id,
    (txn->>'row_index')::int,
    (txn->>'txn_date')::date,
    txn->>'merchant',
    (txn->>'amount')::bigint,
    txn->>'account_code',
    txn->>'verdict'
  from jsonb_array_elements(coalesce(p_transactions, '[]'::jsonb)) as txn;

  -- status·retry_count·error_code 는 건드리지 않는다. 재계산은 실패 재시도 한도를
  -- 쓰지 않고, 성공한 재계산이 completed 를 다른 상태로 옮길 이유도 없다.
  update public.uploads
     set summary = p_summary,
         period_start = p_period_start,
         period_end = p_period_end,
         row_count = p_row_count,
         finished_at = now(),
         recomputed_at = now(),
         recompute_started_at = null
   where id = p_upload_id
     and user_id = p_user_id
     and status = 'completed';

  -- 행이 사라졌거나 더 이상 completed 가 아니면 교체할 대상이 없다. 여기서 죽어야
  -- 위의 delete·insert 까지 함께 롤백되고, 반쯤 갈아엎힌 결과가 남지 않는다.
  if not found then
    raise exception 'upload is not replaceable'
      using errcode = 'no_data_found';
  end if;
end;
$$;

-- create or replace 는 EXECUTE 를 PUBLIC 에 자동으로 준다. 회수가 반드시 뒤에 와야
-- 하고, 순서를 뒤집으면 PostgREST 의 /rest/v1/rpc/ 로 미로그인 호출이 열린다.
revoke execute on function public.replace_upload_result(uuid, uuid, jsonb, jsonb, date, date, int)
  from public, anon, authenticated;

grant execute on function public.replace_upload_result(uuid, uuid, jsonb, jsonb, date, date, int)
  to service_role;
