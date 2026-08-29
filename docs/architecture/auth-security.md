# 認証・セキュリティ

## 認証

Auth0 を identity provider とし、MVP は Google OAuth connection + Universal Login を使う。

```text
React SPA
  ↓ redirect
Auth0 Universal Login
  ↓ Google OAuth 2.0
Auth0 callback / token
  ↓
ConvexProviderWithAuth0
  ↓ token 検証
Convex functions
```

Re:Me は Google アカウントの password / OAuth credential を持たない。Auth0 custom domain は DEV に不要で、Production でも初回リリースの必須条件にしない。

### Google OAuth の redirect 境界

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
- MVP の login に必要な scope は `openid profile email` を基本とし、Google API の追加 scope を要求しない

## Session / ルート

- `Auth0Provider`: login、logout、Auth0 session、プロフィール表示
- `ConvexProviderWithAuth0`: Auth0 token を Convex client へ渡す
- `useConvexAuth()`: 認証済み Convex リクエストが可能かを UI で判定する
- React Router ガード: 未認証ユーザーを `/login` へ案内する

Router ガードは認可の正本ではない。

## 認可

Convex には Supabase RLS 相当の自動 row policy がない。代わりに public function の入口で明示的に強制する。

1. `ctx.auth.getUserIdentity()` が存在する
2. identity の `tokenIdentifier` を内部の `users` document に解決する
3. 操作対象の `ownerId` が現在の `users._id` と一致する
4. status / 封 / 開封 / 削除状態が操作を許可する
5. 許可された field だけを return validator に合わせて返す

共通の認証済み query / mutation wrapper を使い、function ごとの所有権チェック抜けを防ぐ。client から送られた `userId` / 所有者の自己申告は信用しない。

## ユーザー identity モデル

- Auth0 `sub` / Convex `tokenIdentifier`: 外部 identity の検索キー
- `users._id`: ドメイン上の所有権キー

手紙や設定は `users._id` を参照する。将来の provider 紐づけ / アカウント復旧で、外部 subject をドメイン行全体へ直接埋め込まないためである。

## 環境の分離

### DEV / Preview

- Auth0 DEV tenant / SPA application
- Auth0 Google OAuth の DEV connection / client
- localhost と Preview の callback / logout / web origin
- 日常開発の Convex はマシン上の local backend。CI E2E と共有 Preview Worker は Preview deployment
- 個人の cloud developer deployment を local / CI の正本にしない。手順は [Local / Preview 環境](../development/preview-environment.md)

### Production

- Auth0 PROD tenant / SPA application
- Auth0 Google OAuth の PROD connection / client
- production の callback / logout / web origin
- Convex production deployment

Auth0 domain / client id はブラウザに出してよい設定値であり、secret ではない。Google OAuth client secret、Auth0 Management API credential、Convex deploy key、R2 credential、VAPID private key は browser bundle / Git / log に出さない。

## Token 検証

Convex `auth.config.ts` は環境ごとの Auth0 issuer domain と application id を使う。token の issuer / audience が一致しない場合は拒否する。

Custom Auth0 domain へ切り替えると issuer が変わる。Convex auth config、callback URL、session の切り替えを同じ production 変更として扱う。

## 封をした手紙

封をした本文は、本人にも次の条件を満たすまで返さない。

```text
所有者
AND 到着済み
AND openedAt != null
AND deletedAt == null
```

`openLetter` mutation が本人、到着済み、未開封を確認して `openedAt` を設定する。本文取得 query は開封済み状態を再検証する。

これはアプリケーション層のアクセス制御であり、E2EE ではない。Auth0 / Convex / R2 の運用権限者から暗号学的に隠す保証はしない。

## 正確な配送時刻の秘匿

正確な `scheduledAt` は `letterDeliveries` に保存し、ブラウザ向け query の返り値に含めない。返すのは配送レンジだけである。

Debug endpoint、エラー詳細、log、analytics に正確な配送時刻を誤って出さない。

## 送信後の編集不可

送信後に変更できないもの:

- 本文
- 添付
- スレッド / 親手紙
- 封
- 配送モード / レンジ / 正確な時刻
- sentAt

汎用 patch mutation を公開しない。下書き mutation は `status === "draft"` を検証し、送信 / 開封 / 削除は専用 mutation にする。

## 写真 / R2 のプライバシー

- bucket は非公開
- Convex は R2 object id と所有権 metadata を保持する
- 1通あたり最大3枚。入力は JPEG / PNG / WebP、10 MiB 以下
- client の Canvas で JPEG に再 encode し、長辺 4096 px、5 MiB 以下へ縮小して EXIF / XMP / IPTC を除去する
- upload intent 作成時に所有者 / 下書き状態を検証し、Content-Length と `If-None-Match: *` を束縛した、5分だけ有効な staging object 単位の署名 PUT URL を発行する。同じ権限の再利用は既存 object への上書き前に失敗させ、finalize 時の HEAD と完全 JPEG 検査でも intent の byte size・5 MiB 上限・content type を強制する
- finalize 前に R2 HEAD で MIME / size、取得後に JPEG の dimension と APP1 / APP13 metadata が無いことをサーバー側で再検証する
- finalize は attachment ごとの single-flight とし、有効な claim 中は別 runner を拒否して candidate key の並行上書きを防ぐ。外部 copy 前に候補 key を Convex へ永続登録し、検証した staging ETag を条件に一意な immutable final key へ copy する。atomic mutation に勝った key だけを採用し、負けた attempt や copy 後に止まった attempt は durable state と cron retry で削除完了まで追跡する
- 封をした / 未開封 attachment の download URL を返さない
- download 権限は60秒にし、送信後は開封まで新規発行せず、application log に残さない
- 削除は先に `deleting` 状態を記録し、R2 / Convex metadata の部分失敗を15分 cron と指数 backoff で復旧する

## 通知のプライバシー

Push / Email に本文、写真、場所、ユーザー入力テキストを含めない。

> Re:Me  
> あなた宛ての手紙が届いています。

Push subscription の endpoint / key は本人だけが管理できる。ログでは endpoint と auth secret を伏せる。

## 削除 / 長期利用

送信後も削除は可能。client からのアクセスと配送対象から即時除外する論理削除を基本とし、Convex document、R2 object、backup の物理削除・保持期間はプライバシーポリシーと [legacy data migration](../development/legacy-migration.md) で確定する。

Re:Me は数年後の利用を正常系とするため、Auth0 のアカウント復旧、provider 紐づけ、data の export / 削除、Convex の export / backup、基盤移行を本番準備の必須検討にする。チェックリストは [production-readiness.md](../development/production-readiness.md)。構成手順は [production-environment.md](../development/production-environment.md)。

## テスト方針

通常の自動 E2E は Google OAuth UI を通さず、Auth0 の database test identity で Universal Login を完了し、`e2e/.auth/` の `storageState` から認証済み状態を復元する。少数の smoke test だけが以下を確認する。

```text
Google OAuth login
  → Auth0 callback
  → Auth0 token
  → Convex token 検証
  → 認証済み query
```

## 必須のセキュリティテスト

- 未認証の public function を拒否する
- ユーザー A からユーザー B の metadata / 本文 / 添付を取得・変更できない
- 封をした traveling の本文 / 添付を本人が取得できない
- 封をした到着済み・未開封の本文 / 添付を本人が取得できない
- `openLetter` 後だけ本文を取得できる
- 送信後コンテンツの変更が失敗する
- 正確な `scheduledAt` が public の結果 / log / エラーに出ない
- scheduled / internal function をブラウザから呼べない
- 期限切れ / 世代違いの upload / download 権限を拒否する
- Auth0 の issuer / audience 不一致を拒否する
- Google OAuth smoke で Convex の認証済み query まで成功する
