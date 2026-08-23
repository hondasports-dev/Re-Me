# 開発セットアップ

この文書は Auth0 + Convex + Cloudflare target architecture のセットアップ基準。runtime は Auth0 + Convex。legacy `supabase/migrations/` と security tests は invariant 比較用に残し、通常の local / CI test は Supabase 起動を要求しない。

## Prerequisites

- Node.js 24 LTS
- pnpm
- Auth0 account（DEV tenant/application）
- Convex account / project
- Cloudflare account
- Google Cloud project（production 前の専用 OAuth client。local DEV は Auth0 の Google connection で開始できる）

Docker / local PostgreSQL は target architecture の必須条件ではない。

## Target packages

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

### Development

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

package version は導入時の stable を公式 docs と compatibility で確認し、`pnpm-lock.yaml` に固定する。

## Target scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "deploy:backend": "convex deploy",
    "deploy:frontend": "pnpm build && wrangler deploy",
    "lint": "oxlint .",
    "format": "oxfmt .",
    "format:check": "oxfmt . --check",
    "typecheck": "tsc --noEmit",
    "test": "pnpm test:unit && pnpm test:convex && pnpm test:worker",
    "test:e2e": "playwright test",
    "convex:dev": "convex dev",
    "convex:codegen": "convex codegen",
    "convex:check": "convex dev --once",
    "cf:typegen": "wrangler types"
  }
}
```

実際の Convex / Cloudflare deploy command は導入時の公式 docs と CI provider の制約で確定する。Production deploy はこのセットアップ作業の自動実行対象にしない。

## Formatting

Oxfmt が正。Prettier は入れない。改行は LF で固定する。

Windows でも Git の `core.autocrlf` に任せず、`.gitattributes` の `eol=lf` と `.oxfmtrc.json` の `endOfLine: "lf"` を正とする。`pnpm format` が working tree 全体を CRLF に書き換えないようにするため。

## Provider bootstrap

```text
MantineProvider
  └─ Auth0Provider
      └─ ConvexProviderWithAuth0
          └─ React Router
```

`convex/auth.config.ts` に Auth0 issuer domain / application id を environment variables から設定する。config を変更したら developer deployment へ push し、`useConvexAuth()` が authenticated になるところまで確認する。

## Environment boundary

### Browser-visible

```text
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_CONVEX_URL
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
```

### Convex environment secrets

```text
AUTH0_DOMAIN
AUTH0_CLIENT_ID
WEB_PUSH_VAPID_PRIVATE_KEY
WEB_PUSH_SUBJECT
R2 integration credentials / component config
```

Auth0 domain / client id は secret ではないが、DEV / PROD の組み合わせを混ぜない。Management API credential、Google OAuth client secret、Convex deploy key、R2 secret、VAPID private key は `VITE_*` にしない。

### Cloudflare

Workers Static Assets を SPA mode で配信する。application backend secret は Worker に複製しない。R2 credential は Convex integration が必要とする environment に限定する。

## Auth0 DEV setup

1. DEV tenant に Single Page Application を作成
2. Auth0 の Google OAuth connection を DEV SPA に enable する。local の「Googleで続ける」はこれを使う
3. Auth0 の Allowed Callback URLs に `http://127.0.0.1:5173/auth/callback`、`http://127.0.0.1:4173/auth/callback` と必要な preview callback を登録
4. Allowed Logout URLs / Allowed Web Origins に `127.0.0.1` の Vite / Playwright origin と preview origin を登録
5. Auth0 issuer / client id を Convex developer deployment と Vite env に設定する。browser へは `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` / `VITE_CONVEX_URL` だけを出す
6. Universal Login から Google OAuth login を確認する
7. DEV の Username-Password connection を SPA に enable し、public signup は disable する
8. E2E 用 database user を Management API で作成し、`E2E_AUTH0_EMAIL` / `E2E_AUTH0_PASSWORD` は `.env.local` にだけ置く

production 前に Google Cloud の専用 OAuth 2.0 Web client を作り、Authorized redirect URI に `https://<auth0-domain>/login/callback` を登録して Auth0 Google connection へ差し替える。Auth0 の共有 developer key に本番を載せない。

Production tenant / Google OAuth client / callback は共有しない。Custom domain はこの手順の必須条件ではない。

Google OAuth client secret は Auth0 connection にだけ設定し、Vite / Convex application code / Cloudflare Worker へ複製しない。Production で Auth0 custom domain を導入する場合は、Google 側の Authorized redirect URI も `https://<custom-domain>/login/callback` へ切り替える。

## Convex DEV setup

- developer deployment を作成
- `convex/schema.ts` / indexes / `auth.config.ts` を push
- secrets は deployment env に設定
- schema push / type generation / function spec を確認
- test data は developer deployment または isolated test harness に限定

Production data を DEV へコピーする場合は個人情報 inventory と承認を別途必要とする。

## Auth testing

通常 E2E は Google OAuth UI を毎回通さない。Playwright は Auth0 の database test identity で Universal Login を完了し、`storageState` を `e2e/.auth/` に保存して保護ルートと authenticated Convex query（`users.me` / `ensureCurrentUser`）を検証する。

この経路は Playwright preview build だけが `VITE_ALLOW_E2E_DB_LOGIN=1` を持ち、`/login?e2e_db=1` で Username-Password connection を開始する。通常の `pnpm dev` と production build では Google ボタン以外の login 入口を出さない。

Google OAuth smoke は少数だけ実行する。`E2E_GOOGLE_SMOKE=1` のときだけ走る。

```text
Google OAuth login
  → Auth0 callback
  → token issuance
  → Convex token validation
  → authenticated query
```

## First migration success criteria

- Auth0 login / logout / callback が DEV で動く
- Convex auth が issuer / audience を検証する
- authenticated query / mutation が動く
- User A / User B の data boundary test が通る
- Convex schema / indexes / scheduled function が push できる
- React SPA が Cloudflare Worker local runtime で表示される
- standard quality gates が通る
- Supabase / TanStack Query / Hono の runtime import が無い
