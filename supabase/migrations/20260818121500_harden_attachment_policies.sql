-- Harden attachment mutations.
--
-- Location labels may be managed directly by the authenticated client while the
-- parent letter is a draft. Photo metadata must be created/deleted by the
-- authenticated Worker together with the R2 object lifecycle, so browser CRUD
-- cannot create orphan or forged R2 metadata.

begin;

drop policy if exists letter_attachments_insert_draft on public.letter_attachments;
drop policy if exists letter_attachments_delete_draft on public.letter_attachments;

revoke insert, delete on public.letter_attachments from authenticated;

grant insert (letter_id, user_id, kind, location_label)
  on public.letter_attachments
  to authenticated;

grant delete
  on public.letter_attachments
  to authenticated;

create policy letter_attachments_insert_location_draft
on public.letter_attachments
for insert
to authenticated
with check (
  user_id = auth.uid()
  and kind = 'location'
  and r2_key is null
  and location_label is not null
  and exists (
    select 1 from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = auth.uid()
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

create policy letter_attachments_delete_location_draft
on public.letter_attachments
for delete
to authenticated
using (
  user_id = auth.uid()
  and kind = 'location'
  and exists (
    select 1 from public.letters l
    where l.id = letter_attachments.letter_id
      and l.user_id = auth.uid()
      and l.status = 'draft'
      and l.deleted_at is null
  )
);

commit;
