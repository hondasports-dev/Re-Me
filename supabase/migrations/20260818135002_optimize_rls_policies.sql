-- Cache auth.uid() once per statement in RLS policies and index foreign keys
-- used during user deletion cascades.

begin;

create index notification_jobs_user_idx on private.notification_jobs(user_id);
create index letter_attachments_user_idx on public.letter_attachments(user_id);
create index letter_contents_user_idx on public.letter_contents(user_id);

alter policy user_settings_select_own on public.user_settings
using ((select auth.uid()) = user_id);

alter policy user_settings_update_own on public.user_settings
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy threads_select_own on public.threads
using ((select auth.uid()) = user_id and deleted_at is null);

alter policy letters_select_own on public.letters
using ((select auth.uid()) = user_id and deleted_at is null);

alter policy letter_contents_select_visible on public.letter_contents
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.letters l
    where l.id = letter_contents.letter_id
      and l.user_id = (select auth.uid())
      and l.deleted_at is null
      and (
        l.status = 'draft'
        or l.sealed = false
        or l.opened_at is not null
      )
  )
);

alter policy letter_contents_update_draft on public.letter_contents
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.letters l
    where l.id = letter_contents.letter_id
      and l.user_id = (select auth.uid())
      and l.status = 'draft'
      and l.deleted_at is null
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.letters l
    where l.id = letter_contents.letter_id
      and l.user_id = (select auth.uid())
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

alter policy letter_attachments_select_visible on public.letter_attachments
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = (select auth.uid())
      and l.deleted_at is null
      and (
        l.status = 'draft'
        or l.sealed = false
        or l.opened_at is not null
      )
  )
);

alter policy letter_attachments_insert_location_draft on public.letter_attachments
with check (
  user_id = (select auth.uid())
  and kind = 'location'
  and r2_key is null
  and location_label is not null
  and exists (
    select 1
    from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = (select auth.uid())
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

alter policy letter_attachments_delete_location_draft on public.letter_attachments
using (
  user_id = (select auth.uid())
  and kind = 'location'
  and exists (
    select 1
    from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = (select auth.uid())
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

alter policy push_subscriptions_select_own on public.push_subscriptions
using ((select auth.uid()) = user_id);

alter policy push_subscriptions_insert_own on public.push_subscriptions
with check ((select auth.uid()) = user_id);

alter policy push_subscriptions_update_own on public.push_subscriptions
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

alter policy push_subscriptions_delete_own on public.push_subscriptions
using ((select auth.uid()) = user_id);

commit;
