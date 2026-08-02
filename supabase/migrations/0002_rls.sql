alter table public.profiles enable row level security;
alter table public.uploads enable row level security;
alter table public.transactions enable row level security;
alter table public.webhook_events enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using ((select auth.uid()) = user_id);
create policy "profiles_insert_own"
  on public.profiles for insert
  with check ((select auth.uid()) = user_id);
create policy "profiles_update_own"
  on public.profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "profiles_delete_own"
  on public.profiles for delete
  using ((select auth.uid()) = user_id);

create policy "uploads_select_own"
  on public.uploads for select
  using ((select auth.uid()) = user_id);
create policy "uploads_insert_own"
  on public.uploads for insert
  with check ((select auth.uid()) = user_id);
create policy "uploads_update_own"
  on public.uploads for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "uploads_delete_own"
  on public.uploads for delete
  using ((select auth.uid()) = user_id);

create policy "transactions_select_own"
  on public.transactions for select
  using ((select auth.uid()) = user_id);
create policy "transactions_insert_own"
  on public.transactions for insert
  with check ((select auth.uid()) = user_id);
create policy "transactions_update_own"
  on public.transactions for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "transactions_delete_own"
  on public.transactions for delete
  using ((select auth.uid()) = user_id);

revoke all on public.merchant_dictionary from anon, authenticated;
revoke all on public.csv_format_mappings from anon, authenticated;
grant select on public.merchant_dictionary to anon, authenticated;
grant select on public.csv_format_mappings to anon, authenticated;
