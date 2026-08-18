-- Re:Me initial schema
-- Created: 2026-08-18
--
-- Design goals:
-- - public tables expose only data safe to query with RLS
-- - sealed letter body/attachments are hidden until open
-- - exact scheduled_at is private so UI only knows a delivery window
-- - sent letter content is immutable
-- - state transitions happen through trusted RPCs
-- - delivery + notification outbox are idempotent

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.letter_status as enum (
  'draft',
  'traveling',
  'delivered'
);

create type public.delivery_mode as enum (
  'few_days',
  'few_weeks',
  'few_months',
  'about_year',
  'surprise'
);

create type public.attachment_kind as enum (
  'photo',
  'location'
);

create type private.notification_job_status as enum (
  'pending',
  'processing',
  'sent',
  'failed'
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  push_enabled boolean not null default false,
  email_notification_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.letters (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_letter_id uuid references public.letters(id) on delete restrict,
  status public.letter_status not null default 'draft',
  sealed boolean not null default true,
  delivery_mode public.delivery_mode,
  delivery_window_start timestamptz,
  delivery_window_end timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint letters_parent_not_self check (parent_letter_id is null or parent_letter_id <> id),
  constraint letters_delivery_window_order check (
    delivery_window_start is null
    or delivery_window_end is null
    or delivery_window_start <= delivery_window_end
  ),
  constraint letters_state_consistency check (
    (
      status = 'draft'
      and sent_at is null
      and delivered_at is null
      and delivery_mode is null
      and delivery_window_start is null
      and delivery_window_end is null
    )
    or
    (
      status = 'traveling'
      and sent_at is not null
      and delivered_at is null
      and delivery_mode is not null
      and delivery_window_start is not null
      and delivery_window_end is not null
    )
    or
    (
      status = 'delivered'
      and sent_at is not null
      and delivered_at is not null
      and delivery_mode is not null
      and delivery_window_start is not null
      and delivery_window_end is not null
    )
  )
);

create table public.letter_contents (
  letter_id uuid primary key references public.letters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint letter_body_length check (char_length(body) <= 20000)
);

create table public.letter_attachments (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.attachment_kind not null,
  r2_key text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  location_label text,
  created_at timestamptz not null default now(),
  constraint letter_attachment_payload check (
    (
      kind = 'photo'
      and r2_key is not null
      and location_label is null
    )
    or
    (
      kind = 'location'
      and location_label is not null
      and r2_key is null
    )
  ),
  constraint letter_attachment_size check (byte_size is null or byte_size >= 0),
  constraint letter_attachment_dimensions check (
    (width is null or width > 0)
    and (height is null or height > 0)
  )
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Exact delivery time is intentionally private. Users can see the window but not scheduled_at.
create table private.letter_delivery (
  letter_id uuid primary key references public.letters(id) on delete cascade,
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table private.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  letter_id uuid not null references public.letters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status private.notification_job_status not null default 'pending',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_attempt_count check (attempt_count >= 0),
  constraint notification_jobs_unique_delivery unique (letter_id)
);

create index threads_user_created_idx
  on public.threads(user_id, created_at desc)
  where deleted_at is null;

create index letters_user_status_created_idx
  on public.letters(user_id, status, created_at desc)
  where deleted_at is null;

create index letters_thread_created_idx
  on public.letters(thread_id, created_at)
  where deleted_at is null;

create unique index letters_one_reply_per_parent_idx
  on public.letters(parent_letter_id)
  where parent_letter_id is not null and deleted_at is null;

create index letter_attachments_letter_idx
  on public.letter_attachments(letter_id, created_at);

create index push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

create index letter_delivery_due_idx
  on private.letter_delivery(scheduled_at);

create index notification_jobs_ready_idx
  on private.notification_jobs(status, available_at, created_at);

-- updated_at helper
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_settings_touch_updated_at
before update on public.user_settings
for each row execute function private.touch_updated_at();

create trigger threads_touch_updated_at
before update on public.threads
for each row execute function private.touch_updated_at();

create trigger letters_touch_updated_at
before update on public.letters
for each row execute function private.touch_updated_at();

create trigger letter_contents_touch_updated_at
before update on public.letter_contents
for each row execute function private.touch_updated_at();

create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function private.touch_updated_at();

create trigger notification_jobs_touch_updated_at
before update on private.notification_jobs
for each row execute function private.touch_updated_at();

-- Keep sent letter metadata immutable while allowing lifecycle timestamps/status changes.
create function private.prevent_sent_letter_metadata_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    if new.thread_id is distinct from old.thread_id
      or new.user_id is distinct from old.user_id
      or new.parent_letter_id is distinct from old.parent_letter_id
      or new.sealed is distinct from old.sealed
      or new.delivery_mode is distinct from old.delivery_mode
      or new.delivery_window_start is distinct from old.delivery_window_start
      or new.delivery_window_end is distinct from old.delivery_window_end
      or new.sent_at is distinct from old.sent_at
      or new.created_at is distinct from old.created_at
    then
      raise exception 'sent letter metadata is immutable';
    end if;
  end if;

  return new;
end;
$$;

create trigger letters_prevent_sent_metadata_mutation
before update on public.letters
for each row execute function private.prevent_sent_letter_metadata_mutation();

create function private.prevent_sent_letter_content_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.letter_status;
  v_deleted_at timestamptz;
begin
  select l.status, l.deleted_at
    into v_status, v_deleted_at
  from public.letters l
  where l.id = old.letter_id;

  if v_status <> 'draft' and v_deleted_at is null then
    raise exception 'sent letter content is immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger letter_contents_prevent_sent_mutation
before update or delete on public.letter_contents
for each row execute function private.prevent_sent_letter_content_mutation();

create trigger letter_attachments_prevent_sent_mutation
before update or delete on public.letter_attachments
for each row execute function private.prevent_sent_letter_content_mutation();

-- Create default settings when a Supabase auth user is created.
create function public.handle_reme_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_settings(user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_reme
after insert on auth.users
for each row execute function public.handle_reme_new_user();

insert into public.user_settings(user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- RLS
alter table public.user_settings enable row level security;
alter table public.threads enable row level security;
alter table public.letters enable row level security;
alter table public.letter_contents enable row level security;
alter table public.letter_attachments enable row level security;
alter table public.push_subscriptions enable row level security;

create policy user_settings_select_own
on public.user_settings
for select
to authenticated
using (user_id = auth.uid());

create policy user_settings_update_own
on public.user_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy threads_select_own
on public.threads
for select
to authenticated
using (user_id = auth.uid() and deleted_at is null);

create policy letters_select_own
on public.letters
for select
to authenticated
using (user_id = auth.uid() and deleted_at is null);

create policy letter_contents_select_visible
on public.letter_contents
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.letters l
    where l.id = letter_contents.letter_id
      and l.user_id = auth.uid()
      and l.deleted_at is null
      and (
        l.status = 'draft'
        or l.sealed = false
        or l.opened_at is not null
      )
  )
);

create policy letter_contents_update_draft
on public.letter_contents
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.letters l
    where l.id = letter_contents.letter_id
      and l.user_id = auth.uid()
      and l.status = 'draft'
      and l.deleted_at is null
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.letters l
    where l.id = letter_contents.letter_id
      and l.user_id = auth.uid()
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

create policy letter_attachments_select_visible
on public.letter_attachments
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = auth.uid()
      and l.deleted_at is null
      and (
        l.status = 'draft'
        or l.sealed = false
        or l.opened_at is not null
      )
  )
);

create policy letter_attachments_insert_draft
on public.letter_attachments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = auth.uid()
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

create policy letter_attachments_delete_draft
on public.letter_attachments
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = auth.uid()
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

create policy push_subscriptions_select_own
on public.push_subscriptions
for select
to authenticated
using (user_id = auth.uid());

create policy push_subscriptions_insert_own
on public.push_subscriptions
for insert
to authenticated
with check (user_id = auth.uid());

create policy push_subscriptions_update_own
on public.push_subscriptions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy push_subscriptions_delete_own
on public.push_subscriptions
for delete
to authenticated
using (user_id = auth.uid());

-- Direct table privileges are intentionally narrow.
revoke all on public.user_settings from anon, authenticated;
revoke all on public.threads from anon, authenticated;
revoke all on public.letters from anon, authenticated;
revoke all on public.letter_contents from anon, authenticated;
revoke all on public.letter_attachments from anon, authenticated;
revoke all on public.push_subscriptions from anon, authenticated;

grant select on public.user_settings to authenticated;
grant update (timezone, push_enabled, email_notification_enabled) on public.user_settings to authenticated;

grant select on public.threads to authenticated;
grant select on public.letters to authenticated;

grant select on public.letter_contents to authenticated;
grant update (body) on public.letter_contents to authenticated;

grant select, insert, delete on public.letter_attachments to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Draft creation keeps thread/letter/content creation atomic.
create function public.create_draft(p_parent_letter_id uuid default null)
returns table(created_letter_id uuid, created_thread_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_thread_id uuid;
  v_letter_id uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if p_parent_letter_id is null then
    insert into public.threads(user_id)
    values (v_user_id)
    returning id into v_thread_id;
  else
    select l.thread_id
      into v_thread_id
    from public.letters l
    where l.id = p_parent_letter_id
      and l.user_id = v_user_id
      and l.deleted_at is null
      and l.opened_at is not null
      and l.replied_at is null;

    if v_thread_id is null then
      raise exception 'parent letter is not replyable';
    end if;
  end if;

  insert into public.letters(user_id, thread_id, parent_letter_id)
  values (v_user_id, v_thread_id, p_parent_letter_id)
  returning id into v_letter_id;

  insert into public.letter_contents(letter_id, user_id, body)
  values (v_letter_id, v_user_id, '');

  return query select v_letter_id, v_thread_id;
end;
$$;

-- Send a draft. Exact scheduled_at remains private.
create function public.send_letter(
  p_letter_id uuid,
  p_delivery_mode public.delivery_mode,
  p_sealed boolean
)
returns table(
  sent_letter_id uuid,
  window_start timestamptz,
  window_end timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_parent_letter_id uuid;
  v_body text;
  v_min_days integer;
  v_max_days integer;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_scheduled_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  select l.parent_letter_id, c.body
    into v_parent_letter_id, v_body
  from public.letters l
  join public.letter_contents c on c.letter_id = l.id
  where l.id = p_letter_id
    and l.user_id = v_user_id
    and l.status = 'draft'
    and l.deleted_at is null
  for update of l;

  if not found then
    raise exception 'draft letter not found';
  end if;

  if btrim(v_body) = '' then
    raise exception 'letter body is required';
  end if;

  case p_delivery_mode
    when 'few_days' then
      v_min_days := 3;
      v_max_days := 7;
    when 'few_weeks' then
      v_min_days := 14;
      v_max_days := 30;
    when 'few_months' then
      v_min_days := 60;
      v_max_days := 180;
    when 'about_year' then
      v_min_days := 300;
      v_max_days := 430;
    when 'surprise' then
      -- Initial MVP range. Product tuning may change this later.
      v_min_days := 30;
      v_max_days := 365;
    else
      raise exception 'unsupported delivery mode';
  end case;

  v_window_start := now() + make_interval(days => v_min_days);
  v_window_end := now() + make_interval(days => v_max_days);
  v_scheduled_at := v_window_start + ((v_window_end - v_window_start) * random());

  update public.letters
  set status = 'traveling',
      sealed = p_sealed,
      delivery_mode = p_delivery_mode,
      delivery_window_start = v_window_start,
      delivery_window_end = v_window_end,
      sent_at = now()
  where id = p_letter_id;

  insert into private.letter_delivery(letter_id, scheduled_at)
  values (p_letter_id, v_scheduled_at);

  if v_parent_letter_id is not null then
    update public.letters
    set replied_at = now()
    where id = v_parent_letter_id
      and user_id = v_user_id
      and opened_at is not null
      and replied_at is null
      and deleted_at is null;

    if not found then
      raise exception 'parent letter can no longer be replied to';
    end if;
  end if;

  return query select p_letter_id, v_window_start, v_window_end;
end;
$$;

-- Opening a sealed delivered letter is an explicit trusted state transition.
create function public.open_letter(p_letter_id uuid)
returns table(opened_letter_id uuid, opened_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_opened_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.letters
  set opened_at = coalesce(public.letters.opened_at, now())
  where id = p_letter_id
    and user_id = v_user_id
    and status = 'delivered'
    and deleted_at is null
  returning public.letters.opened_at into v_opened_at;

  if v_opened_at is null then
    raise exception 'delivered letter not found';
  end if;

  return query select p_letter_id, v_opened_at;
end;
$$;

-- Soft-delete is allowed even after send. Delivery workers ignore deleted rows.
create function public.delete_letter(p_letter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  update public.letters
  set deleted_at = coalesce(deleted_at, now())
  where id = p_letter_id
    and user_id = v_user_id
    and deleted_at is null;

  if not found then
    raise exception 'letter not found';
  end if;
end;
$$;

-- Cron entry point. It atomically marks due letters delivered and creates outbox jobs.
create function public.deliver_due_letters(p_limit integer default 100)
returns table(delivered_letter_id uuid, delivered_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select l.id
    from public.letters l
    join private.letter_delivery d on d.letter_id = l.id
    where l.status = 'traveling'
      and l.deleted_at is null
      and d.scheduled_at <= now()
    order by d.scheduled_at
    for update of l skip locked
    limit least(greatest(p_limit, 1), 500)
  ), updated as (
    update public.letters l
    set status = 'delivered',
        delivered_at = now()
    from due
    where l.id = due.id
      and l.status = 'traveling'
      and l.deleted_at is null
    returning l.id, l.user_id
  ), jobs as (
    insert into private.notification_jobs(letter_id, user_id)
    select u.id, u.user_id
    from updated u
    on conflict (letter_id) do nothing
    returning letter_id
  )
  select u.id, u.user_id
  from updated u;
end;
$$;

-- Claim notification jobs for the Worker. Stale processing jobs can be reclaimed.
create function public.claim_notification_jobs(p_limit integer default 100)
returns table(
  job_id uuid,
  letter_id uuid,
  user_id uuid,
  attempt_count integer
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
      locked_at = now(),
      last_error = null
  from candidates c
  where j.id = c.id
  returning j.id, j.letter_id, j.user_id, j.attempt_count;
end;
$$;

create function public.complete_notification_job(
  p_job_id uuid,
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
  select j.attempt_count
    into v_attempt_count
  from private.notification_jobs j
  where j.id = p_job_id
  for update;

  if v_attempt_count is null then
    raise exception 'notification job not found';
  end if;

  if p_success then
    update private.notification_jobs
    set status = 'sent',
        sent_at = now(),
        locked_at = null,
        last_error = null
    where id = p_job_id;
  else
    update private.notification_jobs
    set status = 'failed',
        available_at = now() + (least(greatest(v_attempt_count, 1) * 5, 60) * interval '1 minute'),
        locked_at = null,
        last_error = left(coalesce(p_error, 'unknown notification error'), 2000)
    where id = p_job_id;
  end if;
end;
$$;

revoke all on function public.handle_reme_new_user() from public, anon, authenticated;

revoke all on function public.create_draft(uuid) from public, anon;
revoke all on function public.send_letter(uuid, public.delivery_mode, boolean) from public, anon;
revoke all on function public.open_letter(uuid) from public, anon;
revoke all on function public.delete_letter(uuid) from public, anon;

grant execute on function public.create_draft(uuid) to authenticated;
grant execute on function public.send_letter(uuid, public.delivery_mode, boolean) to authenticated;
grant execute on function public.open_letter(uuid) to authenticated;
grant execute on function public.delete_letter(uuid) to authenticated;

revoke all on function public.deliver_due_letters(integer) from public, anon, authenticated;
revoke all on function public.claim_notification_jobs(integer) from public, anon, authenticated;
revoke all on function public.complete_notification_job(uuid, boolean, text) from public, anon, authenticated;

grant execute on function public.deliver_due_letters(integer) to service_role;
grant execute on function public.claim_notification_jobs(integer) to service_role;
grant execute on function public.complete_notification_job(uuid, boolean, text) to service_role;

commit;
