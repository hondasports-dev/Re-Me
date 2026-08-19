-- Keep sent content immutable even after a letter is soft-deleted, and reject
-- attachments added through privileged paths after send.

begin;

create or replace function private.prevent_sent_letter_content_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.letter_status;
begin
  select l.status
    into v_status
  from public.letters l
  where l.id = old.letter_id;

  if v_status <> 'draft' then
    raise exception 'sent letter content is immutable';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function private.prevent_sent_letter_attachment_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.letter_status;
begin
  select l.status
    into v_status
  from public.letters l
  where l.id = new.letter_id;

  if v_status is null then
    raise exception 'letter not found';
  end if;

  if v_status <> 'draft' then
    raise exception 'sent letter content is immutable';
  end if;

  return new;
end;
$$;

create trigger letter_attachments_prevent_sent_insert
before insert on public.letter_attachments
for each row execute function private.prevent_sent_letter_attachment_insert();

commit;
