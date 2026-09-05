# 認証・セキュリティ

## 認証

Auth0 を identity provider とし、MVP は Google OAuth connection + Universal Login
を使う。

```text
React SPA
  ↓ redirect
Auth0 Universal Login
  ↓ Google OAuth 2.0
Auth0 callback / access token
  ↓ Bearer token
Cloudflare Worker API
  ↓ issuer / audience / signature 検証
D1 の内部 user と所有権
```

Re:Me は Google の password / OAuth credential を持たない。Auth0 custom domain は
DEV の必須条件にしない。

## Google OAuth の redirect 境界

- Google Cloud の Authorized redirect URI には Auth0 domain の `/login/callback` を登録する
- Auth0 SPA の Allowed Callback URLs には Re:Me の `/auth/callback` を登録する
- Local / DEV / Preview と Production は Google OAuth client、Auth0 tenant、callback
  URL を共有しない
- MVP の scope は `openid profile email` を基本とし、Google API の追加 scope を要求しない

## Session / ルート

- `Auth0Provider`: login、logout、Auth0 session、プロフィール表示
- `LiveAuthRuntimeProvider`: token 取得と API client への受け渡し
- React Router guard: 未認証ユーザーを `/login` へ案内する

Router guard は認可の正本ではない。API request ごとに Worker が token と D1 所有権を
再検証する。

## 認可

Worker の認証済み API では次を順に強制する。

1. Bearer token の issuer / audience / 署名 / 有効期限を検証する
2. token の `sub` を D1 `users.token_identifier` へ解決または ensure する
3. 操作対象の `owner_id` が現在の内部 user と一致することを確認する
4. status / 封 / 開封 / 削除状態が操作を許可することを確認する
5. browser response は許可された field だけを組み立てる

client から送られた `userId` / 所有者の自己申告は信用しない。重要な状態遷移は
専用 route と D1 transaction で強制する。

## 環境の分離

### DEV / Preview

- Auth0 DEV tenant / SPA application
- Auth0 Google OAuth の DEV connection / client
- localhost と固定 Preview URL の callback / logout / web origin
- Cloudflare の Preview Worker / D1 / R2 / Queue / secret

### Production

- Auth0 PROD tenant / SPA application（未作成）
- Auth0 Google OAuth の PROD connection / client（未作成）
- Production Worker / D1 / R2 / Queue（未デプロイ）

Auth0 domain、client id、API base URL、VAPID public key は browser に出してよい設定値
やが、VAPID public key は Worker の `/api/push/config` から実行時に返し、browser bundle
へ build-time 注入せえへん。Cloudflare API token、capability secret、VAPID private key、
Auth0 Management API credential は browser bundle / Git / log に出さない。

## 封をした手紙

封をした本文・写真は、次をすべて満たすまで Worker API が返さない。

```text
所有者
AND 到着済み
AND opened_at != null
AND deleted_at == null
```

`open` route は本人、到着済み、未開封を D1 上で確認してから `opened_at` を記録する。
本文・添付の取得 route は response 直前にも同じ条件を再検証する。これは E2EE では
なく、アプリケーション層のアクセス制御である。

## 正確な配送時刻の秘匿

正確な `letter_deliveries.scheduled_at` は内部 D1 row に保存し、browser response、
debug endpoint、error、analytics、log に含めない。ユーザーへ返すのは配送 window
だけや。

## 送信後の編集不可

送信後に変更できないもの:

- 本文、添付、スレッド / 親手紙
- 封、配送 mode / window / 正確な時刻
- `sent_at`

draft route は `status = 'draft'` を検証し、send / open / delete は専用 route と
transaction にする。D1 trigger は Worker authorization の補助線として immutable
field を保護する。

## 写真 / R2 のプライバシー

- bucket は非公開
- Worker が upload / download capability を発行し、owner、letter、generation、
  TTL、byte size を束縛する
- 1通あたり最大3枚。入力は JPEG / PNG / WebP、10 MiB 以下
- client 再 encode と Worker の JPEG / metadata 検査で EXIF / XMP / IPTC を除去する
- finalize は R2 HEAD、ETag、generation token、single-flight claim を再検証する
- sealed / 未開封 attachment の download capability は発行しない
- deleting state は scheduled reconcile が R2 と D1 の後始末を完了するまで保持する

## 通知のプライバシー

Push / Email に本文、写真、場所、ユーザー入力テキスト、正確な時刻を含めない。

> Re:Me
> あなた宛ての手紙が届いています。

Push endpoint と key は本人だけが管理し、log では endpoint host 以外を出さない。

## 削除 / 長期利用

送信後も削除は可能。client からのアクセスと配送対象から即時除外する論理削除を
基本とし、object の物理削除は D1 の reconcile state と保持方針に従う。

## テスト方針

通常の自動 E2E は Google OAuth UI を通さず、Auth0 database test identity の
storage state から認証済み状態を復元する。少数の OAuth smoke test だけが次を確認する。

```text
Google OAuth login
  → Auth0 callback
  → Auth0 access token
  → Worker authenticated API
```

必須の security / access-control case:

- 未認証、issuer / audience 不一致、期限切れ token を拒否する
- user A から user B の metadata / 本文 / 添付を取得・変更できない
- sealed traveling / 未開封 delivery の本文・添付を拒否する
- open 後だけ本文・添付を取得できる
- 送信後コンテンツ変更を拒否する
- exact `scheduledAt`、secret、R2 key を response / log に出さない
- 期限切れ / 世代違い capability と無効 endpoint を安全に処理する
