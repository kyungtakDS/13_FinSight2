create extension if not exists pg_cron;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'expire-csv-uploads-daily';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'expire-csv-uploads-daily',
    '15 3 * * *',
    $job$
      with expired_uploads as (
        select id, storage_path
        from public.uploads
        where expires_at < now()
          and storage_path is not null
        for update
      ),
      removed_objects as (
        delete from storage.objects as object
        using expired_uploads as upload
        where object.bucket_id = 'csv-uploads'
          and object.name = upload.storage_path
      )
      update public.uploads as upload
      set storage_path = null
      from expired_uploads as expired
      where upload.id = expired.id;
    $job$
  );
end;
$$;
