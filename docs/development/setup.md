# 開発セットアップ

この文書は Auth0 + Convex + Cloudflare target architecture のセットアップ基準。現行 repository の dependency / scripts は移行前であり、実装 Issue で段階的に置き換える。

## Prerequisites

- Node.js 24 LTS
- pnpm
- Auth0 account（DEV tenant/application）
- Convex account / project
- Cloudflare account
- Google Cloud project（DEV OAuth client）

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

TanStack Query、Supabase client、Hono は migration 完了後に削除する。Convex data へ別の query cache を重ねない。

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
    "convex:check": "convex dev --once",
    "cf:typegen": "wrangler types"
  }
}
```

実際の Convex / Cloudflare deploy command は導入時の公式 docs と CI provider の制約で確定する。Production deploy はこのセットアップ作業の自動実行対象にしない。

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
2. Google Cloud に DEV 用 OAuth 2.0 Web client と consent screen を作成
3. Google の Authorized redirect URI に `https://<auth0-dev-domain>/login/callback` を登録
4. Auth0 に Google OAuth DEV connection を作成し、DEV SPA application のみ enable
5. Auth0 の Allowed Callback URLs に `http://localhost:5173/auth/callback` と必要な preview callback を登録
6. Allowed Logout URLs / Allowed Web Origins に localhost と preview origin を登録
7. Universal Login から Google OAuth login を確認
8. Auth0 issuer / client id を Convex developer deployment と Vite env に設定
9. `ConvexProviderWithAuth0` 経由の authenticated query を確認

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

通常 E2E は Google OAuth UI を毎回通さない。Auth0 test identity / session fixture または isolated backend harness で認証済み状態を作り、Re:Me の authorization と user flow を検証する。

Google OAuth smoke は少数だけ実行する。

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
- Supabase / TanStack Query / Hono の runtime import、scripts、env が撤去される
