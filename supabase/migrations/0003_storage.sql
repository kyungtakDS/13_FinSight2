insert into storage.buckets (id, name, public)
values ('csv-uploads', 'csv-uploads', false)
on conflict (id) do update set public = false;

create policy "csv_uploads_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'csv-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "csv_uploads_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'csv-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "csv_uploads_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'csv-uploads'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
