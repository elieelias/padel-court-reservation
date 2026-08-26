-- Runs the protected notification email worker once per minute using a secret stored in Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $function$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'dispatch-notification-emails';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$function$;

select cron.schedule(
  'dispatch-notification-emails',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://bwzfvyjkkcvpyiebvrwp.supabase.co/functions/v1/send-notification-emails',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-dispatch-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'email_dispatch_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 10000
    );
  $cron$
);
