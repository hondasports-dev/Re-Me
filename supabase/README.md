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
- notification job の claim token による Worker 世代管理
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

`scheduled_at` を public table に置くと browser から取得できてしまうため、`private.letter_delivery` に分離する。

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

### Environment policy

- Local / DEV: Supabase CLI の local Auth (GoTrue) + local PostgreSQL
- Production: Supabase Cloud Auth + PostgreSQL
- Google OAuth: local 開発用 OAuth client と production 用 OAuth client を分離

cloud Supabase DEV project は MVP の必須要件にしない。

通常の automated E2E は Google UI を経由せず、local Auth の test user / session を使う。Google OAuth の実連携は少数の smoke test として分離する。

## Local workflow

Supabase CLI は project の dev dependency として固定している。Docker Desktop などの Docker-compatible runtime を起動してから実行する。

```text
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:advisors
pnpm db:test
pnpm db:types
pnpm db:stop
```

local development では database だけでなく Auth (GoTrue) も起動する。React migration 完了時に `db:start` は Auth を除外しない構成へ変更する。

remote Supabase project や Dashboard の手作業は、この local workflow の前提にしない。初回は Docker image の取得に時間がかかる。`db:advisors` は security / performance の warning 以上を CI failure にする。

生成した public schema の TypeScript types は `src/shared/types/database.generated.ts` に commit する。schema 変更後は `pnpm db:types` で再生成し、手編集しない。

## Local auth testing

通常の E2E では local Supabase Auth に test user を用意し、認証済み session を fixture として利用する。

これにより以下を Google UI から独立して検証する。

- auth-required route
- user A / user B の access boundary
- RLS
- sealed letter visibility
- trusted RPC
- draft / send / open / reply flow

Google OAuth smoke test は別に実施し、provider login → Supabase callback → React `/auth/callback` → session restore までを確認する。

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
10. `create_draft -> send_letter` の基本遷移が成功する
11. 一つの parent に複数の非削除 reply を作れない
12. notification job の claim → complete が token 世代を検証する
13. reclaim 後の旧 token 完了、完了済み job の再完了が拒否される

追加で attachment visibility、soft-delete 後の immutability、delivery / notification outbox の冪等性、anon access denial も固定する。
