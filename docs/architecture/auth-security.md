# 認証・セキュリティ

## Authentication

Auth0 を identity provider とし、MVP は Google OAuth connection + Universal Login を使う。

```text
React SPA
  ↓ redirect
Auth0 Universal Login
  ↓ Google OAuth 2.0
Auth0 callback / token
  ↓
ConvexProviderWithAuth0
  ↓ token verification
Convex functions
```

Re:Me は Google account password / OAuth credential を保持しない。Auth0 custom domain は DEV に不要で、Production でも初回リリースの必須条件にしない。

### Google OAuth redirect boundary

Redirect は二段階で分ける。

```text
Google OAuth 2.0
  → https://<auth0-domain>/login/callback
Auth0
  → https://<re-me-domain>/auth/callback
```

- Google Cloud の Authorized redirect URI には Auth0 domain の `/login/callback` を登録する
- Auth0 SPA の Allowed Callback URLs には Re:Me の `/auth/callback` を登録する
- Local / DEV と Production は Google OAuth client、Auth0 tenant、callback URL を共有しない
- MVP は login に必要な `openid profile email` を基本とし、Google API の追加 scope を要求しない

## Session / route

- `Auth0Provider`: login、logout、Auth0 session、profile presentation
- `ConvexProviderWithAuth0`: Auth0 token を Convex client へ供給
- `useConvexAuth()`: authenticated Convex request が可能かを UI で判定
- React Router guard: 未認証 user を `/login` へ案内

Router guard は authorization の source of truth ではない。

## Authorization

Convex には Supabase RLS 相当の自動 row policy がない。代わりに public function の入口で明示的に強制する。

1. `ctx.auth.getUserIdentity()` が存在する
2. identity の `tokenIdentifier` を internal `users` document に解決する
3. request target の `ownerId` が current `users._id` と一致する
4. status / sealed / opened / deleted state が操作を許可する
5. 許可された field だけを return validator に合わせて返す

共通の authenticated query / mutation wrapper を使い、function ごとの ownership check 抜けを防ぐ。client から送られた `userId` / owner claim は信用しない。

## User identity model

- Auth0 `sub` / Convex `tokenIdentifier`: external identity lookup key
- `users._id`: domain ownership key

Letter や settings は `users._id` を参照する。将来 provider link / account recovery を行う際に、外部 subject を domain row 全体へ直接埋め込まないためである。

## Environment separation

### DEV

- Auth0 DEV tenant / SPA application
- Auth0 Google OAuth DEV connection / client
- localhost と preview callback / logout / web origins
- Convex developer / preview deployment

### Production

- Auth0 PROD tenant / SPA application
- Auth0 Google OAuth PROD connection / client
- production callback / logout / web origins
- Convex production deployment

Auth0 domain / client id は browser-visible configuration だが secret ではない。Google OAuth client secret、Auth0 Management API credential、Convex deploy key、R2 credential、VAPID private key は browser bundle / Git / log に出さない。

## Token validation

Convex `auth.config.ts` は environment ごとの Auth0 issuer domain と application id を使う。token の issuer / audience が一致しない場合は拒否する。

Custom Auth0 domain へ切り替えると issuer が変わるため、Convex auth config、callback URL、session cutover を同じ production change として扱う。

## Sealed letter

sealed content は本人にも以下の条件まで返さない。

```text
owner
AND delivered
AND openedAt != null
AND deletedAt == null
```

`openLetter` mutation が本人、delivered、unopened を確認して `openedAt` を設定する。本文取得 query は開封済み state を再検証する。

これは application-level access control であり E2EE ではない。Auth0 / Convex / R2 の運用権限者から暗号学的に隠す保証はしない。

## Exact schedule secrecy

exact `scheduledAt` は `letterDeliveries` に保存し、browser-facing query の return shape に含めない。delivery window だけを返す。

Debug endpoint、error detail、log、analytics に exact schedule を誤って出さない。

## Sent immutability

送信後に変更できないもの:

- body
- attachment
- thread / parent
- sealed
- delivery mode / window / exact schedule
- sentAt

generic patch mutation を公開しない。draft mutation は `status === "draft"` を検証し、send / open / delete は専用 mutation にする。

## Photo / R2 privacy

- bucket は private
- Convex は R2 object id と ownership metadata を保持
- upload intent 作成時に owner / draft state を検証
- MIME、size、dimension、EXIF / location metadata を検証
- sealed / unopened attachment の download URL を返さない
- download capability は短命にし、送信後は開封まで新規発行せず、application log に残さない
- delete は Convex metadata と R2 object の partial failure を reconciliation できる状態で行う

## Notification privacy

Push / Email に本文、写真、location、ユーザー入力テキストを含めない。

> Re:Me  
> あなた宛ての手紙が届いています。

Push subscription endpoint / key は本人だけが管理できる。ログでは endpoint と auth secret を redact する。

## Deletion / longevity

送信後も削除は可能。client access と delivery 対象から即時除外する soft delete を基本とし、Convex document、R2 object、backup の物理削除・保持期間は Privacy Policy と migration issue で確定する。

Re:Me は数年後の利用を正常系とするため、Auth0 account recovery、provider link、data export / delete、Convex export / backup、vendor migration を production readiness の必須検討にする。

## Testing strategy

通常の automated E2E は Google OAuth UI を通さず、Auth0 の database test identity で Universal Login を完了し、`e2e/.auth/` の `storageState` から authenticated state を復元する。少数の smoke test だけが以下を確認する。

```text
Google OAuth login
  → Auth0 callback
  → Auth0 token
  → Convex token verification
  → authenticated query
```

## Required security tests

- unauthenticated public function denial
- User A から User B の metadata / body / attachment を取得・変更できない
- sealed traveling body / attachment を本人が取得できない
- sealed delivered + unopened body / attachment を本人が取得できない
- `openLetter` 後だけ content を取得できる
- sent content mutation が失敗する
- exact `scheduledAt` が public result / log / error に出ない
- scheduled / internal function を browser から呼べない
- expired / wrong-generation upload / download capability を拒否する
- Auth0 issuer / audience mismatch を拒否する
- Google OAuth smoke で Convex authenticated query まで成功する
