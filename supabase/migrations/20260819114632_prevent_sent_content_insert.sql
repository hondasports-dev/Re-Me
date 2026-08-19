-- A sent letter must not acquire a body after the draft lifecycle has ended.

begin;

create function private.prevent_sent_letter_content_insert()
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

create trigger letter_contents_prevent_sent_insert
before insert on public.letter_contents
for each row execute function private.prevent_sent_letter_content_insert();

commit;
