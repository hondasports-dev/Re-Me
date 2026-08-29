# 開発セットアップ

この文書は Auth0 + Convex + Cloudflare という target architecture のセットアップ基準。runtime は Auth0 + Convex。legacy `supabase/migrations/` は不変条件の比較用に残し、通常の local / CI test は Supabase 起動を要求しない。

## 前提

- Node.js 24 LTS
- pnpm
- Auth0 アカウント（DEV tenant/application）
- Convex アカウント / project（Preview / production。local 開発の backend は CLI の local deployment）
- Cloudflare アカウント
- Google Cloud project（本番前の専用 OAuth client。local DEV は Auth0 の Google connection で開始できる）

Docker / local PostgreSQL は target architecture の必須条件ではない。

## 採用するパッケージ

### Runtime

```text
react
react-dom
react-router
@mantine/core
@mantine/hooks
@mantine/notifications
@auth0/auth0-react
convex
@convex-dev/r2
```

TanStack Query、Supabase client、Hono は runtime に含めない。Convex data へ別の query cache を重ねない。

### 開発

```text
typescript
vite
@vitejs/plugin-react
@cloudflare/vite-plugin
wrangler
oxlint
oxfmt
vitest
@testing-library/react
@testing-library/jest-dom
@testing-library/user-event
jsdom
@cloudflare/vitest-pool-workers
@playwright/test
convex-test
```

package の version は導入時の stable を公式ドキュメントと互換性で確認し、`pnpm-lock.yaml` に固定する。

## 採用する scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "dev:full": "node scripts/convex-dev-target.mjs --start \"vite dev\"",
    "build": "vite build",
    "deploy:backend": "convex deploy",
    "deploy:frontend": "pnpm build && wrangler deploy",
    "lint": "oxlint .",
    "format": "oxfmt .",
    "format:check": "oxfmt . --check",
    "typecheck": "tsc --noEmit",
    "test": "pnpm test:unit && pnpm test:convex && pnpm test:worker",
    "test:e2e": "playwright test",
    "convex:dev": "node scripts/convex-dev-target.mjs",
    "convex:codegen": "convex codegen",
    "convex:check": "node scripts/convex-dev-target.mjs --once",
    "cf:typegen": "wrangler types"
  }
}
```

実際の Convex / Cloudflare の deploy コマンドは導入時の公式ドキュメントと CI の制約で確定する。Production deploy はこのセットアップ作業の自動実行対象にしない。

## フォーマット

Oxfmt が正。Prettier は入れない。改行は LF で固定する。

Windows でも Git の `core.autocrlf` に任せず、`.gitattributes` の `eol=lf` と `.oxfmtrc.json` の `endOfLine: "lf"` を正とする。`pnpm format` が working tree 全体を CRLF に書き換えないようにするため。

## Provider の組み立て

```text
MantineProvider
  └─ Auth0Provider
      └─ ConvexProviderWithAuth0
          └─ React Router
```

`convex/auth.config.ts` に Auth0 issuer domain / application id を環境変数から設定する。config を変更したら local Convex へ push し、`useConvexAuth()` が認証済みになるところまで確認する。

## 環境の境界

Local と共有 Preview の具体的な構築・rollback 手順は [`preview-environment.md`](./preview-environment.md) を正とする。Production は別 Issue で扱い、このセットアップ作業では作成・更新しない。

### ブラウザに出してよい値

```text
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_CONVEX_URL
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
```

### Convex 環境の秘密情報

```text
AUTH0_DOMAIN
AUTH0_CLIENT_ID
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_SUBJECT
R2 integration の credential / component 設定
```

R2 component は以下の4値を Convex deployment の環境にだけ設定する。値を `.env.local`、Vite、Worker、GitHub log へ複製しない。

```text
R2_BUCKET
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Auth0 domain / client id は secret ではないが、DEV / PROD の組み合わせを混ぜない。Management API credential、Google OAuth client secret、Convex deploy key、R2 secret、VAPID private key は `VITE_*` にしない。

### Cloudflare

Workers Static Assets を SPA mode で配信する。application backend の secret は Worker に複製しない。R2 credential は Convex integration が必要とする環境に限定する。

## Auth0 DEV のセットアップ

1. DEV tenant に Single Page Application を作成する
2. Auth0 の Google OAuth connection を DEV SPA に有効化する。local の「Googleで続ける」はこれを使う
3. Auth0 の Allowed Callback URLs に `http://127.0.0.1:5173/auth/callback`、`http://127.0.0.1:4173/auth/callback` と必要な Preview callback を登録する
4. Allowed Logout URLs / Allowed Web Origins に `127.0.0.1` の Vite / Playwright origin と Preview origin を登録する
5. Auth0 issuer / client id を local Convex と Vite env に設定する。ブラウザへは `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` / `VITE_CONVEX_URL` だけを出す。`VITE_CONVEX_URL` は `pnpm convex:dev` が書く local URL を使う
6. Universal Login から Google OAuth login を確認する
7. DEV の Username-Password connection を SPA に有効化し、公開サインアップは無効にする
8. E2E 用 database user を Management API で作成し、`E2E_AUTH0_EMAIL` / `E2E_AUTH0_PASSWORD` は `.env.local` にだけ置く

本番前に Google Cloud の専用 OAuth 2.0 Web client を作り、Authorized redirect URI に `https://<auth0-domain>/login/callback` を登録して Auth0 Google connection へ差し替える。Auth0 の共有 developer key に本番を載せない。

Production tenant / Google OAuth client / callback は共有しない。Custom domain はこの手順の必須条件ではない。

Google OAuth client secret は Auth0 connection にだけ設定し、Vite / Convex application code / Cloudflare Worker へ複製しない。Production で Auth0 custom domain を導入する場合は、Google 側の Authorized redirect URI も `https://<custom-domain>/login/callback` へ切り替える。

## Convex local のセットアップ

日常の local 開発は cloud の developer deployment ではなく、マシン上の local Convex backend を使う。接続先の正本は [Local / Preview 環境](./preview-environment.md) の「Convex の使い分け」を見る。

- 初回だけ `pnpm exec convex deployment create local --select`（既存なら `pnpm convex:dev` が `deployment select local` する）
- `convex/schema.ts` / indexes / `auth.config.ts` を local backend へ push する（`pnpm convex:dev` または `pnpm convex:check`）
- local backend が動いている間に `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` と DEV R2 の4値を `pnpm exec convex env set` で local deployment へ設定する
- ブラウザの `VITE_CONVEX_URL` は `http://127.0.0.1:3210` 系の local URL になる。cloud URL を `.env.local` に固定しない
- local backend の状態は gitignored の `.convex/` に置く
- `convex dev` を止めると local backend も止まる。frontend だけ `pnpm dev` しても Convex には繋がらない
- `"use node"` の action は手元の Node.js 24 で動く。local backend を使うときは同じ major を使う
- CI / Preview は共有 Preview の remote Convex を使う。local E2E は local backend が起動している必要がある
- どうしても cloud developer deployment を使う場合だけ `CONVEX_ALLOW_CLOUD_DEV=1` を付けて無料枠を消費することを明示する。このとき wrapper は `deployment select dev` する

Production data を local へコピーする場合は個人情報の棚卸しと承認を別途必要とする。

## 認証テスト

通常 E2E は Google OAuth UI を毎回通さない。Playwright は Auth0 の database test identity で Universal Login を完了し、`storageState` を `e2e/.auth/` に保存して保護ルートと認証済み Convex query（`users.me` / `ensureCurrentUser`）を検証する。

この経路は Playwright preview build だけが `VITE_ALLOW_E2E_DB_LOGIN=1` を持ち、`/login?e2e_db=1` で Username-Password connection を開始する。通常の `pnpm dev` と production build では Google ボタン以外の login 入口を出さない。

Google OAuth smoke は少数だけ実行する。`E2E_GOOGLE_SMOKE=1` のときだけ走る。

```text
Google OAuth login
  → Auth0 callback
  → token 発行
  → Convex token 検証
  → 認証済み query
```

## 最初の移行の成功条件

- Auth0 の login / logout / callback が DEV で動く
- Convex auth が issuer / audience を検証する
- 認証済み query / mutation が動く
- ユーザー A / ユーザー B のデータ境界テストが通る
- Convex schema / indexes / scheduled function を push できる
- React SPA が Cloudflare Worker の local runtime で表示される
- 標準の品質ゲートが通る
- Supabase / TanStack Query / Hono の runtime import が無い
