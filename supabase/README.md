# Supabase

Re:Me の Auth / PostgreSQL / RLS を管理するディレクトリ。

## Source of truth

DB schema と policy は Dashboard の手作業ではなく `supabase/migrations/` を正とする。

変更時は新しい migration を追加し、既存 migration を書き換えない。

## Initial schema

`20260818120000_initial_schema.sql` では以下を定義する。

- `user_settings`
- `threads`
- `letters`
- `letter_contents`
- `letter_attachments`
- `push_subscriptions`
- private exact delivery schedule
- private notification outbox
- RLS policies
- sent letter immutability triggers
- draft / send / open / delete RPC
- due delivery / notification job RPC

## Important design

### metadata と本文を分離する

`letters` は一覧表示に必要な metadata、`letter_contents` は本文を持つ。

これにより封をした手紙について、到着・開封前でも「未来を旅している」という metadata は見せながら、本文は RLS で取得不能にできる。

### exact scheduled_at は private

ユーザーは「数か月後くらい」という window は確認できるが、正確な到着日時は確認できない。

`schedule_at` を public table に置くと browser から取得できてしまうため、`private.letter_delivery` に分離する。

### trusted state transition

以下は direct table update ではなく RPC を使う。

- `create_draft`
- `send_letter`
- `open_letter`
- `delete_letter`
- `deliver_due_letters`
- `claim_notification_jobs`
- `complete_notification_job`

## Auth

MVP は Supabase Auth + Google OAuth を第一候補とする。

Browser で使う publishable / anon key と、Worker だけが使う service role credential を明確に分離する。

Service Role は Cloudflare Worker Secret に置き、Browser bundle や repository に含めない。

## Local workflow

実装 issue で Supabase CLI を導入した後の想定:

```text
pnpm supabase start
pnpm supabase db reset
pnpm supabase gen types ...
```

実際の scripts / project-id は scaffold 時に確定する。

## RLS test requirement

少なくとも以下を自動テストする。

1. User A から User B の thread / letter metadata が見えない
2. sealed + traveling の本文が本人にも見えない
3. sealed + delivered + unopened の本文が本人にも見えない
4. `open_letter` 後に本文が見える
5. unsealed の sent letter は本人が読み返せる
6. sent letter の本文 update が拒否される
7. draft の本文 update は許可される
8. exact `scheduled_at` が authenticated client から取得できない
9. authenticated user から delivery RPC を実行できない
