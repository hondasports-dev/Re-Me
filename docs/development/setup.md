# 開発セットアップ

この文書は実装開始時の基準。Foundation scaffold 完了後は、リポジトリ直下の `package.json` / `wrangler.jsonc` / env example と `pnpm-lock.yaml` を正とする。

## Prerequisites

- Node.js 24 LTS
- pnpm
- Cloudflare account
- Supabase project

## Package baseline

### Runtime dependencies

```text
vue
vue-router
primevue
@primeuix/themes
primeicons
@supabase/supabase-js
hono
```

### Development dependencies

```text
typescript
vite
@vitejs/plugin-vue
@cloudflare/vite-plugin
wrangler
vue-tsc
oxlint
oxfmt
vitest
@vue/test-utils
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
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "cf:typegen": "wrangler types"
  }
}
```

Supabase CLI scripts は local project 初期化後に追加する。

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

## Local DB

Supabase CLI を初期化後、migration を local DB に適用する。

```text
supabase start
supabase db reset
```

初期 migration:

```text
supabase/migrations/20260818120000_initial_schema.sql
```

## Generated DB types

Supabase schema から TypeScript type を生成し、手書きで DB row type を複製しない。

配置候補:

```text
src/shared/types/database.generated.ts
```

生成ファイルは format 対象にはするが、原則手編集しない。

## Generated Worker types

Wrangler の Worker runtime type は以下で生成する。

```text
pnpm cf:typegen
```

生成先は `worker-configuration.d.ts`。Wrangler の設定や binding を変更した場合は再生成し、生成ファイルは手編集しない。

## First local success criteria

Foundation scaffold の完了条件として以下が通ること。

```text
pnpm install
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Playwright の基本 E2E はブラウザをインストールした環境で `pnpm test:e2e` を実行する。

ブラウザで mobile viewport の空 AppShell が表示され、Worker health endpoint が local workerd で応答するところまでを foundation とする。
