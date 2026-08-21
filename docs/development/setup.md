# 開発セットアップ

この文書は React / Mantine へ移行後の実装開始基準。Foundation scaffold 完了後は、リポジトリ直下の `package.json` / `wrangler.jsonc` / env example と `pnpm-lock.yaml` を正とする。

## Prerequisites

- Node.js 24 LTS
- pnpm
- Docker-compatible runtime
- Cloudflare account
- Supabase account / Production project
- Google Cloud project

日常開発では cloud Supabase DEV project を必須にせず、Supabase CLI の local stack を利用する。

## Package baseline

### Runtime dependencies

```text
react
react-dom
react-router
@tanstack/react-query
@mantine/core
@mantine/hooks
@mantine/notifications
@supabase/supabase-js
hono
```

### Development dependencies

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
supabase
```

package version は scaffold 時点の stable を採用し、`pnpm-lock.yaml` で固定する。

## Expected scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "pnpm build && wrangler deploy",
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "format": "oxfmt .",
    "format:check": "oxfmt . --check",
    "typecheck": "tsc --noEmit",
    "test": "pnpm test:unit && pnpm test:worker",
    "test:unit": "vitest run --config vitest.config.ts",
    "test:worker": "vitest run --config vitest.worker.config.ts",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "supabase": "supabase",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset --local --no-seed --yes",
    "db:lint": "supabase db lint --local --level warning",
    "db:advisors": "supabase db advisors --local --type all --level warn --fail-on warn",
    "db:test": "supabase test db --local",
    "db:types": "supabase gen types --local --schema public > src/shared/types/database.generated.ts",
    "cf:typegen": "wrangler types"
  }
}
```

## Frontend bootstrap

`src/app/providers.tsx` で application-wide provider を集約する。

```text
MantineProvider
  └─ QueryClientProvider
      └─ Supabase Auth Provider
          └─ React Router
```

実際の nest 順は実装上の制約に応じて調整してよいが、feature 内へ provider を重複配置しない。

Mantine theme は `src/styles/theme.ts`、Re:Me 固有 token は `src/styles/tokens.css` を基準にする。

## Environment boundary

### Browser-visible

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

publishable / anon credential は RLS 前提で Browser から利用する。

### Worker secret

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WEB_PUSH_VAPID_PRIVATE_KEY
```

### Worker non-secret / config

```text
WEB_PUSH_VAPID_PUBLIC_KEY
WEB_PUSH_SUBJECT
```

実際の名称は implementation issue で統一する。

Service Role / VAPID private key を `VITE_*` にしない。

## R2 binding

想定 binding:

```text
LETTER_PHOTOS
```

写真 object は public bucket にしない。

## Local Supabase

Supabase CLI は dev dependency として `pnpm-lock.yaml` に固定する。Docker-compatible runtime を起動後、PostgreSQL と Auth を含む local stack を起動する。

```text
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:advisors
pnpm db:test
```

remote Supabase project や Dashboard の手作業は、この local workflow の前提にしない。

初期 migration:

```text
supabase/migrations/20260818120000_initial_schema.sql
```

## Google OAuth local smoke test

Google OAuth は local でも実連携確認できるが、通常の automated E2E では毎回通さない。

1. `.env` に DEV 用 `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` を設定する（`VITE_` は付けない）
2. `supabase/config.toml` の `[auth.external.google].enabled` を一時的に `true` にする
3. `pnpm db:start` で GoTrue を含む local stack を起動する
4. `E2E_GOOGLE_SMOKE=1 pnpm test:e2e e2e/google-oauth.smoke.spec.ts` で smoke を実行する

smoke test の確認範囲:

```text
Google login
  ↓
Supabase local Auth callback
  ↓
React /auth/callback
  ↓
Supabase session restore
  ↓
認証必須 route 表示
```

production 用 OAuth client と credential を共用しない。

## Automated auth E2E

通常の Playwright test は Google UI を経由せず、local Supabase Auth の test user / session を fixture として利用する。

現行 scaffold の通常 E2E:

- anonymous visitor → `/login`
- OAuth callback error の有限表示
- `E2E_AUTH_ENABLED=1` 時のみ、local session restore → protected `/`

letter feature 実装後に追加する通常 E2E:

- auth-required route
- user A / user B の分離
- RLS
- sealed letter visibility
- draft / send / open / reply の user flow

Google OAuth integration は smoke test、アプリの認証済み挙動は local Auth E2E と分離する。

## Generated DB types

Supabase schema から TypeScript type を生成し、手書きで DB row type を複製しない。

配置:

```text
src/shared/types/database.generated.ts
```

public schema の生成コマンド:

```text
pnpm db:types
```

生成ファイルは format 対象にはするが、手編集しない。CI は再生成後の差分を検知する。

## Generated Worker types

Wrangler の Worker runtime type は以下で生成する。

```text
pnpm cf:typegen
```

生成先は `worker-configuration.d.ts`。Wrangler の設定や binding を変更した場合は再生成し、生成ファイルは手編集しない。

## First local success criteria

React migration / Foundation scaffold の完了条件として以下が通ること。

```text
pnpm install
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

加えて、以下を確認する。

- mobile viewport で MantineProvider 適用済みの空 AppShell が表示される
- React Router が client navigation できる
- TanStack Query provider が利用可能
- Worker health endpoint が local workerd で応答する
- local Supabase PostgreSQL / Auth が起動する
- test session で auth-required route を開ける

Playwright の基本 E2E はブラウザをインストールした環境で `pnpm test:e2e` を実行する。
