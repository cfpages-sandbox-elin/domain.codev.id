do $$
declare
  domain_check_job record;
  matching_jobs integer := 0;
begin
  if to_regclass('cron.job') is null then
    raise warning 'pg_cron is not enabled; create a check-domains job with schedule */15 * * * *';
    return;
  end if;

  for domain_check_job in
    select jobid
    from cron.job
    where command ilike '%check-domains%'
  loop
    perform cron.alter_job(domain_check_job.jobid, schedule := '*/15 * * * *');
    matching_jobs := matching_jobs + 1;
  end loop;

  if matching_jobs = 0 then
    raise warning 'No existing check-domains cron job found; create one with schedule */15 * * * *';
  end if;
end
$$;
