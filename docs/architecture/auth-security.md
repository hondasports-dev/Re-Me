# 認証・セキュリティ

## Auth

Supabase Auth を採用し、Social Login を中心にする。

MVP:

- Google OAuth

追加候補:

- Apple OAuth

Browser は Supabase の publishable / anon credential を使う。Service Role は Cloudflare Worker Secret のみに置き、Browser bundle・GitHub・ログへ出さない。

## Session

SPA 起動時に Supabase session を application provider で復元・購読し、React Router の auth-required route で未認証 user を `/login` へ誘導する。

OAuth callback は `/auth/callback` へ集約する。

React Router の route protection は UX 上の入口制御にすぎない。認証済みでも、認可は UI や route guard だけに依存せず DB RLS / trusted RPC / Worker 側で強制する。

TanStack Query の cache に auth session を source of truth として保存しない。session は Supabase Auth を正とし、server-state query は現在の認証状態に応じて enable / invalidate する。

## Local / Production auth environments

MVP は cloud Supabase project を DEV / PROD のためだけに二重化しない。

### Local / DEV

- Supabase CLI の local PostgreSQL を使う
- Supabase CLI の local Auth (GoTrue) を起動する
- local Supabase 起動時に GoTrue を除外しない
- Google OAuth を実際に確認する場合だけ local 開発用 OAuth client を利用する

### Production

- Supabase Cloud project
- production 用 Google OAuth client

Google OAuth client は local / production で分離し、redirect URI の取り違えを避ける。

## Auth testing strategy

認証テストは責務を分ける。

### Unit / component

- auth provider の状態遷移
- 未認証時の route redirect
- session loading / logout 後の UI

外部 Google UI は呼ばない。

### Automated E2E

通常の Playwright E2E は local Supabase Auth にテストユーザーを用意し、session を取得・再利用して認証済み状態を作る。

Google のログイン画面を critical E2E の前提にしない。外部 UI、CAPTCHA、MFA、bot detection、Google 側変更による不安定性をプロダクト E2E から切り離す。

### Google OAuth smoke test

少数の smoke test で以下だけを確認する。

```text
React app
  ↓
Supabase Auth
  ↓
Google OAuth
  ↓
/auth/callback
  ↓
Supabase session 作成
  ↓
認証済み画面へ遷移
```

この smoke test は OAuth provider と Supabase Auth の integration 確認が目的であり、全機能 E2E の入口にはしない。

## RLS

public schema のユーザーデータは RLS を必須とする。

基本原則:

```text
row.user_id = auth.uid()
```

ただし Re:Me では「本人であっても封をした本文を到着前に読めない」という追加条件がある。

そのため metadata と body を分離する。

### letters

本人の metadata は SELECT 可能。

### letter_contents / letter_attachments

本人であっても以下の場合のみ SELECT 可能。

- draft
- `sealed = false`
- `opened_at is not null`

これにより sealed + traveling / sealed + delivered + unopened の本文は authenticated client から取得できない。

## Column / operation privileges

RLS だけでなく table privilege も絞る。

Browser から直接許可しないもの:

- `letters` INSERT / UPDATE / DELETE
- `threads` INSERT / UPDATE / DELETE
- sent content update
- delivery state update

重要な状態変更は RPC 経由にする。

## Trusted RPC

Authenticated user:

- `create_draft`
- `send_letter`
- `open_letter`
- `delete_letter`

Service Role only:

- `deliver_due_letters`
- `claim_notification_jobs`
- `complete_notification_job`

Service Role RPC は anon / authenticated から EXECUTE できないよう revoke する。

Notification outbox の完了 RPC は job id だけでなく現在の `claim_token` も検証する。reclaim 後に遅れて到着した旧 Worker の結果や、完了済み job の再完了は拒否し、別世代の通知状態を上書きできないようにする。

## Sent letter immutability

送信後編集不可は UI ルールだけではなく、本文の後付け INSERT を含む DB trigger でも守る。

変更不可:

- 本文
- 添付
- parent / thread
- seal
- delivery mode / window
- sent_at

変更可能:

- delivered / opened / replied lifecycle timestamp
- soft delete

React component / TanStack Query mutation の client-side validation は補助であり、immutability の source of truth にしない。

## Exact schedule secrecy

正確な `scheduled_at` は `private.letter_delivery` に保存し、authenticated client の SELECT 対象にしない。

ユーザーには public の delivery window だけを返す。

これは秘密情報というより、Re:Me の「いつ届くか分からない」体験を API contract で壊しにくくするための境界。

## Sealed letter

「封をする」は MVP では **ユーザーアクセスを DB / API で制御する機能** とする。

ただし E2EE ではない。

意味:

- 本人の通常 client からも到着・開封前は本文取得不可
- Service Role / DB operator まで暗号学的に読めないことは保証しない

将来「運営にも読めない」を提供する場合は E2EE / key recovery / device migration を別 ADR で設計する。

## Worker authentication

R2 upload など `/api/*` では Supabase access token を検証し、user id を request body から信用しない。

Worker は検証済み token の subject から user を確定する。

## Notification privacy

Push / Email に以下を含めない。

- 本文
- 写真
- location
- ユーザーが入力した任意テキスト

通知文:

> Re:Me  
> あなた宛ての手紙が届いています。

## Photo privacy

- R2 object は public にしない
- object key を推測困難にする
- 認可済み route / 期限付き access を使う
- upload 前または upload 処理で EXIF を除去する
- MIME / byte size / dimension を検証する

## Push subscription

Web Push endpoint / key は本人だけが CRUD できる RLS を設定する。

ログに endpoint / auth secret を不用意に出さない。

## Deletion

送信後編集不可でも削除は可能。

初期 schema は soft delete で delivery / client access から即座に除外する。

R2 object・DB row の最終物理削除、バックアップ保持期間、退会時一括削除は Privacy Policy と実装 issue で確定する。

## Account longevity

Re:Me は数か月〜数年後に戻ることが正常系。

一般的な短期 SaaS より以下を重要視する。

- OAuth provider 継続性
- email / provider 変更
- account recovery
- 退会と data export / delete
- 長期 backup / migration

## Required security tests

- User A から User B の metadata / body を取得できない
- sealed traveling body を本人が SELECT できない
- sealed delivered + unopened body を本人が SELECT できない
- `open_letter` 後だけ body が SELECT 可能になる
- sent body update が失敗する
- authenticated user が service-role-only delivery RPC を実行できない
- exact scheduled time を authenticated client が取得できない
- unauthenticated route access が login へ誘導される
- Google OAuth smoke test で callback 後に Supabase session が生成される
