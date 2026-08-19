# 認証・セキュリティ

## Auth

Supabase Auth を採用し、Social Login を中心にする。

MVP:

- Google OAuth

追加候補:

- Apple OAuth

Browser は Supabase の publishable / anon credential を使う。Service Role は Cloudflare Worker Secret のみに置き、Browser bundle・GitHub・ログへ出さない。

## Session

SPA 起動時に Supabase session を復元し、Vue Router guard で認証必須 route を制御する。

OAuth callback は `/auth/callback` へ集約する。

認証済みでも、認可は UI や router guard だけに依存せず DB RLS / Worker 側で強制する。

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
