# Legacy Supabase artifacts

このディレクトリは **runtime ではない**。Auth0 + Convex へ移行したあとも、production data migration / rollback 方針が固まるまで invariant 比較用に残す。

残すもの:

- `supabase/migrations/` — legacy PostgreSQL / RLS / RPC の正本
- `supabase/tests/` — legacy security tests
- `supabase/config.toml` — local comparison 用

通常の `pnpm test` / Quality gates / E2E は local Supabase を起動しない。比較が必要なときだけ `pnpm db:start` と CI の `Database security gates` job を使う。

最終削除は implementation-order の data migration issue と Human Gate で行う。

---

## Legacy schema contents

このディレクトリはかつての PostgreSQL / RLS / RPC 正本であり、現行 runtime の Auth / backend ではない。

## Source of truth (legacy comparison)

現行 backend の正本は `convex/schema.ts` である。legacy PostgreSQL / RLS を比較するときは Dashboard の手作業ではなく `supabase/migrations/` を正とする。

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

## Auth (legacy)

これらの migration は Supabase Auth を前提に書かれている。現行 runtime の authentication は Auth0、authorization は Convex function である。新しい Supabase client / Service Role Worker path を追加しない。

## Local comparison workflow

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

比較用に `pnpm db:start` すると local PostgreSQL と Auth (GoTrue) も起動する。これは runtime や通常 E2E の前提ではない。

remote Supabase project や Dashboard の手作業は、この local workflow の前提にしない。初回は Docker image の取得に時間がかかる。`db:advisors` は security / performance の warning 以上を CI failure にする。

生成した public schema の TypeScript types は `supabase/database.generated.ts` に出す（gitignored、runtime では使わない）。schema 比較が必要なときだけ `pnpm db:types` で再生成する。

## RLS test requirement

これらは legacy PostgreSQL / RLS の比較用 SQL test である。現行の user-facing E2E や Quality gates の前提ではない。

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
