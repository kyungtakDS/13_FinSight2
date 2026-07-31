create table if not exists public.profiles (
  user_id uuid primary key references auth.users,
  email text,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  polar_customer_id text unique,
  polar_subscription_id text,
  source_modified_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.uploads (
  id uuid primary key,
  user_id uuid not null references auth.users,
  -- While retained, paths must be {user_id}/{upload_id}.csv. Expiry sets this to null.
  storage_path text check (
    storage_path is null
    or storage_path = user_id::text || '/' || id::text || '.csv'
  ),
  filename text,
  file_hash text not null,
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  error_code text,
  retry_count int not null default 0,
  period_start date,
  period_end date,
  row_count int,
  summary jsonb,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.transactions (
  id bigserial primary key,
  upload_id uuid not null references public.uploads on delete cascade,
  user_id uuid not null references auth.users,
  row_index int not null,
  txn_date date not null,
  merchant text not null,
  amount bigint not null,
  account_code text,
  verdict text not null check (verdict in ('expense', 'personal', 'uncertain'))
);

create table if not exists public.merchant_dictionary (
  merchant_key text primary key,
  account_code text not null check (
    account_code in (
      'welfare',
      'travel',
      'entertainment',
      'comms',
      'utilities',
      'taxes',
      'rent',
      'repair',
      'insurance',
      'vehicle',
      'shipping',
      'training',
      'books',
      'supplies',
      'fees',
      'ads',
      'outsourcing',
      'etc'
    )
  ),
  default_verdict text not null check (default_verdict in ('expense', 'personal')),
  reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.csv_format_mappings (
  header_fingerprint text primary key,
  column_map jsonb not null,
  header_row_index int not null,
  encoding text,
  created_at timestamptz default now()
);

create table if not exists public.webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  processed_at timestamptz default now()
);

create index if not exists uploads_user_created_at_idx
  on public.uploads (user_id, created_at desc);
create unique index if not exists uploads_user_file_hash_idx
  on public.uploads (user_id, file_hash);
create index if not exists uploads_active_expiry_idx
  on public.uploads (expires_at) where status <> 'failed';
create index if not exists transactions_upload_row_idx
  on public.transactions (upload_id, row_index);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_auth_user();
  end if;
end;
$$;
