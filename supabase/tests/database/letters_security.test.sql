begin;

create extension if not exists pgtap with schema extensions;

select plan(64);

insert into auth.users (id, email)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user-a@example.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user-b@example.test');

insert into public.threads (id, user_id)
values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

-- Fixture letters start as drafts so body/attachment rows are created through
-- the same lifecycle that production code uses before they are sent.
insert into public.letters (id, thread_id, user_id)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );

insert into public.letter_contents (letter_id, user_id, body)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'sealed traveling'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'unsealed traveling'
  );

insert into public.letter_attachments (
  id,
  letter_id,
  user_id,
  kind,
  r2_key,
  mime_type,
  byte_size
)
values (
  'a1000000-0000-4000-8000-000000000001',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'photo',
  'tests/sealed.jpg',
  'image/jpeg',
  100
);

insert into public.letter_attachments (
  id,
  letter_id,
  user_id,
  kind,
  location_label
)
values (
  'a1000000-0000-4000-8000-000000000003',
  'aaaaaaaa-0000-4000-8000-000000000003',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'location',
  'Somewhere'
);

insert into public.letters (
  id,
  thread_id,
  user_id,
  status,
  sealed,
  delivery_mode,
  delivery_window_start,
  delivery_window_end,
  sent_at,
  delivered_at,
  opened_at
)
values
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'draft', true, null, null, null, null, null, null),
  ('aaaaaaaa-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'draft', true, null, null, null, null, null, null),
  ('aaaaaaaa-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'draft', true, null, null, null, null, null, null),
  ('aaaaaaaa-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'draft', true, null, null, null, null, null, null),
  ('aaaaaaaa-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'draft', true, null, null, null, null, null, null),
  ('bbbbbbbb-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'draft', true, null, null, null, null, null, null);

insert into public.letter_contents (letter_id, user_id, body)
values
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'sealed delivered'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000004',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'draft body'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000005',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'reply parent'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000006',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'due letter'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'user b body'
  );

update public.letters
set status = 'traveling',
    sealed = true,
    delivery_mode = 'few_days',
    delivery_window_start = now() + interval '3 days',
    delivery_window_end = now() + interval '7 days',
    sent_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

update public.letters
set status = 'traveling',
    sealed = false,
    delivery_mode = 'few_days',
    delivery_window_start = now() + interval '3 days',
    delivery_window_end = now() + interval '7 days',
    sent_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000003';

update public.letters
set status = 'delivered',
    sealed = true,
    delivery_mode = 'few_days',
    delivery_window_start = now() - interval '7 days',
    delivery_window_end = now() - interval '3 days',
    sent_at = now() - interval '8 days',
    delivered_at = now() - interval '1 day'
where id = 'aaaaaaaa-0000-4000-8000-000000000002';

update public.letters
set status = 'delivered',
    sealed = true,
    delivery_mode = 'few_days',
    delivery_window_start = now() - interval '10 days',
    delivery_window_end = now() - interval '5 days',
    sent_at = now() - interval '11 days',
    delivered_at = now() - interval '4 days',
    opened_at = now() - interval '3 days'
where id = 'aaaaaaaa-0000-4000-8000-000000000005';

update public.letters
set status = 'traveling',
    sealed = true,
    delivery_mode = 'few_days',
    delivery_window_start = now() - interval '2 days',
    delivery_window_end = now() + interval '2 days',
    sent_at = now() - interval '3 days'
where id in (
  'aaaaaaaa-0000-4000-8000-000000000006',
  'aaaaaaaa-0000-4000-8000-000000000007'
);

update public.letters
set status = 'traveling',
    sealed = false,
    delivery_mode = 'few_days',
    delivery_window_start = now() + interval '3 days',
    delivery_window_end = now() + interval '7 days',
    sent_at = now()
where id = 'bbbbbbbb-0000-4000-8000-000000000001';

insert into private.letter_delivery (letter_id, scheduled_at)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', now() + interval '5 days'),
  ('aaaaaaaa-0000-4000-8000-000000000003', now() + interval '5 days'),
  ('aaaaaaaa-0000-4000-8000-000000000006', now() - interval '1 minute'),
  ('bbbbbbbb-0000-4000-8000-000000000001', now() + interval '5 days');

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select results_eq(
  $$select count(*) from public.threads$$,
  array[1::bigint],
  'User A sees only their own thread'
);
select is_empty(
  $$select id from public.threads where id = '22222222-2222-4222-8222-222222222222'$$,
  'User A cannot read User B thread metadata'
);
select is_empty(
  $$select id from public.letters where id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  'User A cannot read User B letter metadata'
);
select is_empty(
  $$select letter_id from public.letter_contents where letter_id = 'bbbbbbbb-0000-4000-8000-000000000001'$$,
  'User A cannot read User B letter content'
);
select is_empty(
  $$select body from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'A sealed traveling letter is hidden from its owner'
);
select is_empty(
  $$select body from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  'A sealed delivered unopened letter is hidden from its owner'
);
select lives_ok(
  $$select * from public.open_letter('aaaaaaaa-0000-4000-8000-000000000002')$$,
  'The owner can explicitly open a delivered letter'
);
select results_eq(
  $$select body from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000002'$$,
  array['sealed delivered'::text],
  'Opened sealed content becomes visible'
);
select results_eq(
  $$select body from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  array['unsealed traveling'::text],
  'Unsealed sent content remains visible'
);
select is_empty(
  $$select id from public.letter_attachments where letter_id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  'A sealed traveling attachment is hidden'
);
select results_eq(
  $$select location_label from public.letter_attachments where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  array['Somewhere'::text],
  'An unsealed sent attachment remains visible'
);
select is_empty(
  $$update public.letter_contents set body = 'tampered' where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003' returning letter_id$$,
  'Authenticated updates cannot target sent content'
);
select results_eq(
  $$select body from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  array['unsealed traveling'::text],
  'A rejected sent update leaves content unchanged'
);
select lives_ok(
  $$update public.letter_contents set body = 'updated draft' where letter_id = 'aaaaaaaa-0000-4000-8000-000000000004'$$,
  'The owner can update draft content'
);
select results_eq(
  $$select body from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000004'$$,
  array['updated draft'::text],
  'The draft update is persisted'
);
select is(
  has_schema_privilege('authenticated', 'private', 'usage'),
  false,
  'Authenticated clients have no private schema usage'
);
select throws_ok(
  $$select scheduled_at from private.letter_delivery limit 1$$,
  '42501',
  'permission denied for schema private',
  'Authenticated clients cannot query exact delivery times'
);
select is(
  has_function_privilege('authenticated', 'public.deliver_due_letters(integer)', 'execute'),
  false,
  'Authenticated clients have no delivery RPC privilege'
);
select throws_ok(
  $$select * from public.deliver_due_letters(1)$$,
  '42501',
  'permission denied for function deliver_due_letters',
  'Authenticated delivery RPC calls are rejected'
);
select lives_ok(
  $$create temporary table created_draft on commit drop as select * from public.create_draft()$$,
  'create_draft creates an atomic draft result'
);
select lives_ok(
  $$update public.letter_contents set body = 'RPC body' where letter_id = (select created_letter_id from created_draft)$$,
  'The created draft body can be populated'
);
select lives_ok(
  $$select * from public.send_letter((select created_letter_id from created_draft), 'few_days', true)$$,
  'create_draft to send_letter succeeds'
);
select results_eq(
  $$select status::text from public.letters where id = (select created_letter_id from created_draft)$$,
  array['traveling'::text],
  'The RPC-created letter is traveling after send'
);
select lives_ok(
  $$select * from public.create_draft('aaaaaaaa-0000-4000-8000-000000000005')$$,
  'The first reply draft can be created'
);
select throws_ok(
  $$select * from public.create_draft('aaaaaaaa-0000-4000-8000-000000000005')$$,
  '23505',
  'duplicate key value violates unique constraint "letters_one_reply_per_parent_idx"',
  'A second non-deleted reply for one parent is rejected'
);
select results_eq(
  $$select count(*) from public.user_settings$$,
  array[1::bigint],
  'User A sees only their own settings'
);
select is_empty(
  $$select user_id from public.user_settings where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  'User A cannot read User B settings'
);

reset role;
set local role anon;

select throws_ok(
  $$select * from public.letters limit 1$$,
  '42501',
  'permission denied for table letters',
  'Anonymous clients cannot query letter metadata'
);
select is(
  has_function_privilege('anon', 'public.create_draft(uuid)', 'execute'),
  false,
  'Anonymous clients cannot execute create_draft'
);

reset role;

select throws_ok(
  $$update public.letter_contents set body = 'privileged tamper' where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'P0001',
  'sent letter content is immutable',
  'The trigger rejects privileged sent-content updates'
);
select throws_ok(
  $$insert into public.letter_contents (letter_id, user_id, body) values ('aaaaaaaa-0000-4000-8000-000000000007', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'late body')$$,
  'P0001',
  'sent letter content is immutable',
  'The trigger rejects privileged sent-content inserts'
);
select throws_ok(
  $$delete from public.letter_contents where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'P0001',
  'sent letter content is immutable',
  'The trigger rejects privileged sent-content deletes'
);
select lives_ok(
  $$update public.letters set deleted_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'A sent letter can be soft-deleted'
);
select throws_ok(
  $$update public.letter_contents set body = 'deleted tamper' where letter_id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'P0001',
  'sent letter content is immutable',
  'Soft-deleted sent content remains immutable'
);
select throws_ok(
  $$
    insert into public.letter_attachments (
      letter_id,
      user_id,
      kind,
      location_label
    ) values (
      'aaaaaaaa-0000-4000-8000-000000000001',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'location',
      'Too late'
    )
  $$,
  'P0001',
  'sent letter content is immutable',
  'Privileged paths cannot add attachments after send'
);

set local role service_role;

select is(
  (select count(*) from public.deliver_due_letters(10)),
  1::bigint,
  'The service role delivers one due letter'
);
select is(
  (select count(*) from public.deliver_due_letters(10)),
  0::bigint,
  'Repeated delivery is idempotent'
);

reset role;

insert into private.notification_jobs (letter_id, user_id)
values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

update private.notification_jobs
set created_at = now() - interval '3 minutes'
where letter_id = 'aaaaaaaa-0000-4000-8000-000000000006';
update private.notification_jobs
set created_at = now() - interval '2 minutes'
where letter_id = 'aaaaaaaa-0000-4000-8000-000000000002';
update private.notification_jobs
set created_at = now() - interval '1 minute'
where letter_id = 'aaaaaaaa-0000-4000-8000-000000000005';

select is(
  (select status::text from public.letters where id = 'aaaaaaaa-0000-4000-8000-000000000006'),
  'delivered',
  'The due letter transitions to delivered'
);
select is(
  (select count(*) from private.notification_jobs where letter_id = 'aaaaaaaa-0000-4000-8000-000000000006'),
  1::bigint,
  'Delivery creates exactly one notification job'
);
select is(
  has_function_privilege('authenticated', 'public.claim_notification_jobs(integer)', 'execute'),
  false,
  'Authenticated clients cannot claim notification jobs'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.complete_notification_job(uuid,uuid,boolean,text)',
    'execute'
  ),
  false,
  'Authenticated clients cannot complete notification jobs'
);
select is(
  to_regprocedure('public.complete_notification_job(uuid,boolean,text)') is null,
  true,
  'The old completion function signature is removed'
);
select is(
  has_function_privilege(
    'anon',
    'public.complete_notification_job(uuid,uuid,boolean,text)',
    'execute'
  ),
  false,
  'Anonymous clients cannot complete notification jobs'
);

set local role service_role;

select lives_ok(
  $$create temporary table notification_claim_one on commit drop as
    select * from public.claim_notification_jobs(1)$$,
  'The service role can claim one notification job'
);
select is(
  (select count(*) from notification_claim_one),
  1::bigint,
  'A claim returns one notification job'
);
select is(
  (select claim_token is not null from notification_claim_one),
  true,
  'A claim returns a claim token'
);
select lives_ok(
  $$select public.complete_notification_job(
    (select job_id from notification_claim_one),
    (select claim_token from notification_claim_one),
    true,
    null
  )$$,
  'The current claim can complete successfully'
);

reset role;

select is(
  (select status::text from private.notification_jobs where letter_id = 'aaaaaaaa-0000-4000-8000-000000000006'),
  'sent',
  'A successful completion marks the job sent'
);
select is(
  (
    select claim_token is null and locked_at is null
    from private.notification_jobs
    where letter_id = 'aaaaaaaa-0000-4000-8000-000000000006'
  ),
  true,
  'A successful completion clears the claim token and lock'
);

set local role service_role;

select lives_ok(
  $$create temporary table notification_claim_stale on commit drop as
    select * from public.claim_notification_jobs(1)$$,
  'The service role can claim a second notification job'
);

reset role;

update private.notification_jobs
set locked_at = now() - interval '16 minutes',
    created_at = now() - interval '1 hour'
where id = (select job_id from notification_claim_stale);

set local role service_role;

select lives_ok(
  $$create temporary table notification_claim_reclaimed on commit drop as
    select * from public.claim_notification_jobs(1)$$,
  'A stale notification claim can be reclaimed'
);
select is(
  (
    select job_id = (select job_id from notification_claim_stale)
    from notification_claim_reclaimed
  ),
  true,
  'Reclaiming returns the same notification job'
);
select is(
  (
    select claim_token <> (select claim_token from notification_claim_stale)
    from notification_claim_reclaimed
  ),
  true,
  'Reclaiming a job issues a new claim token'
);
select throws_ok(
  $$select public.complete_notification_job(
    (select job_id from notification_claim_stale),
    (select claim_token from notification_claim_stale),
    true,
    null
  )$$,
  'P0001',
  'notification job claim is stale or invalid',
  'The old claim token cannot complete a reclaimed job'
);

reset role;

select is(
  (select status::text from private.notification_jobs where id = (select job_id from notification_claim_stale)),
  'processing',
  'A stale-token completion leaves the reclaimed job processing'
);

set local role service_role;

select lives_ok(
  $$select public.complete_notification_job(
    (select job_id from notification_claim_reclaimed),
    (select claim_token from notification_claim_reclaimed),
    true,
    null
  )$$,
  'The new claim token can complete the reclaimed job'
);

select throws_ok(
  $$select public.complete_notification_job(
    (select job_id from notification_claim_reclaimed),
    (select claim_token from notification_claim_reclaimed),
    true,
    null
  )$$,
  'P0001',
  'notification job claim is stale or invalid',
  'A completed job cannot be completed again'
);

reset role;

select is(
  (select status::text from private.notification_jobs where id = (select job_id from notification_claim_reclaimed)),
  'sent',
  'The new claim token completion marks the reclaimed job sent'
);

set local role service_role;

select lives_ok(
  $$create temporary table notification_claim_failure on commit drop as
    select * from public.claim_notification_jobs(1)$$,
  'The service role can claim a job for failure handling'
);
select lives_ok(
  $$select public.complete_notification_job(
    (select job_id from notification_claim_failure),
    (select claim_token from notification_claim_failure),
    false,
    'push failed'
  )$$,
  'The current claim can complete with a failure'
);

reset role;

select is(
  (
    select status = 'failed' and claim_token is null and locked_at is null
    from private.notification_jobs
    where id = (select job_id from notification_claim_failure)
  ),
  true,
  'A failed completion clears the claim token and lock'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'letters'
      and column_name = 'scheduled_at'
  ),
  0::bigint,
  'Exact scheduled_at is absent from public letters'
);
select is(
  (
    select count(*)
    from private.letter_delivery
    where letter_id = (select created_letter_id from created_draft)
  ),
  1::bigint,
  'send_letter stores one exact private delivery row'
);

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is_empty(
  $$select id from public.letters where id = 'aaaaaaaa-0000-4000-8000-000000000003'$$,
  'Soft-deleted letters are hidden from the owner'
);

select * from finish();
rollback;
