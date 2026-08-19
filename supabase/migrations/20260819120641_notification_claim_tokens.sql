-- Bind notification completion to the specific worker claim that owns it.

begin;

alter table private.notification_jobs
  add column claim_token uuid;

-- Jobs already processing when this migration is applied cannot be completed
-- with the pre-token API. Give them an opaque generation so they can only be
-- completed by a worker that claims them again.
update private.notification_jobs
set claim_token = extensions.gen_random_uuid()
where status = 'processing'
  and claim_token is null;

alter table private.notification_jobs
  add constraint notification_jobs_claim_token_state check (
    (
      status = 'processing'
      and claim_token is not null
    )
    or (
      status <> 'processing'
      and claim_token is null
    )
  );

drop function public.claim_notification_jobs(integer);
drop function public.complete_notification_job(uuid, boolean, text);

create function public.claim_notification_jobs(p_limit integer default 100)
returns table(
  job_id uuid,
  letter_id uuid,
  user_id uuid,
  attempt_count integer,
  claim_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select j.id
    from private.notification_jobs j
    where (
        j.status in ('pending', 'failed')
        and j.available_at <= now()
      )
      or (
        j.status = 'processing'
        and j.locked_at < now() - interval '15 minutes'
      )
    order by j.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 500)
  )
  update private.notification_jobs j
  set status = 'processing',
      attempt_count = j.attempt_count + 1,
      claim_token = extensions.gen_random_uuid(),
      locked_at = now(),
      last_error = null
  from candidates c
  where j.id = c.id
  returning j.id, j.letter_id, j.user_id, j.attempt_count, j.claim_token;
end;
$$;

create function public.complete_notification_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_count integer;
begin
  if p_claim_token is null then
    raise exception 'notification job claim is stale or invalid';
  end if;

  select j.attempt_count
    into v_attempt_count
  from private.notification_jobs j
  where j.id = p_job_id
    and j.status = 'processing'
    and j.claim_token = p_claim_token
  for update;

  if not found then
    raise exception 'notification job claim is stale or invalid';
  end if;

  if p_success then
    update private.notification_jobs
    set status = 'sent',
        sent_at = now(),
        claim_token = null,
        locked_at = null,
        last_error = null
    where id = p_job_id
      and status = 'processing'
      and claim_token = p_claim_token;
  else
    update private.notification_jobs
    set status = 'failed',
        available_at = now() + (least(greatest(v_attempt_count, 1) * 5, 60) * interval '1 minute'),
        sent_at = null,
        claim_token = null,
        locked_at = null,
        last_error = left(coalesce(p_error, 'unknown notification error'), 2000)
    where id = p_job_id
      and status = 'processing'
      and claim_token = p_claim_token;
  end if;
end;
$$;

revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_job(uuid, uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.claim_notification_jobs(integer) to service_role;
grant execute on function public.complete_notification_job(uuid, uuid, boolean, text) to service_role;

commit;
