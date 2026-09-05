# 開発セットアップ

Re:Meのruntimeは Auth0 + Cloudflare Workers + D1 + private R2 + Queues で構成する。Convexはcutover / rollback window中だけ残すlegacy backendや。legacy Supabaseは比較資料で、通常のlocal / CI testはSupabase起動を要求しない。

## 前提

- Node.js 24 LTS
- pnpm 11
- Auth0 DEV tenant / SPA application
- Cloudflare account
- Google Cloud project（production用OAuth clientはDEVと分離）

## Runtime package

```text
react / react-dom / react-router
@mantine/core / @mantine/hooks / @mantine/notifications
@auth0/auth0-react
@tanstack/react-query
hono / jose
```

Cloudflare側のruntime packageは `wrangler`、`@cloudflare/vite-plugin`、D1 / R2 / Queue bindingや。formatterはOxfmt、linterはOxlint、typecheckはTypeScriptを使う。Convex / `@convex-dev/r2` はlegacy compatibility window中だけ依存・testを保持し、new codeからimportせえへん。

## 主な scripts

```text
pnpm dev
pnpm dev:full
pnpm build
pnpm deploy:preview
pnpm deploy:production   # Human Gate後だけ
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test:unit
pnpm test:worker
pnpm test:convex         # legacy compatibility window中
pnpm test:e2e
pnpm cf:typegen
```

`dev:full` と `dev` はCloudflare Vite pluginを通った同じlocal Worker runtimeを起動する。`deploy:preview` はPreview build → D1 migrations → Preview Worker deploy、`deploy:production` はProductionの同じ順や。Production commandはproduction data / trafficのHuman Gateを代替せえへん。

## Provider / API

```text
MantineProvider
  └─ QueryClientProvider
      └─ Auth0Provider
          └─ API client provider
              └─ React Router
```

Auth0はauthentication、Workerの認証済みAPIがauthorizationとdomain state transitionのsource of truthや。ブラウザはTanStack QueryでWorker APIを読むが、Convex query cacheを重ねない。`letters` metadataと本文をWorker/D1で分け、exact `scheduledAt` はbrowser responseへ出さへん。

## Browser environment

```text
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_API_BASE_URL
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
```

Browserへ出さない:

```text
AUTH0_AUDIENCE / CAPABILITY_SECRET
VAPID_PRIVATE_KEY / VAPID_SUBJECT
CLOUDFLARE_API_TOKEN
R2 credential
E2E_AUTH0_PASSWORD
```

`VITE_*` は公開値だけや。`VITE_API_BASE_URL` はlocalでは空（same-origin）、Preview / Productionでは固定Worker URLを指定する。

## Auth0 DEV のセットアップ

1. DEV tenantの既存SPA `Re:Me DEV` を使う。新しいSPAは作らない
2. Google OAuth connectionを有効化する
3. local callback / logout / web originと固定Preview URLを登録する
4. `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` を `.env.local` に設定する
5. Universal LoginでGoogle loginを確認する
6. E2E用database userは `E2E_AUTH0_EMAIL` / `E2E_AUTH0_PASSWORD` としてcanonical `.env.local`だけに置く。chat / log / commitへ出さない

### `VITE_AUTH0_*` の入れ方

`VITE_AUTH0_DOMAIN` と `VITE_AUTH0_CLIENT_ID` はSPAの公開値でsecretやない。Auth0 CLIを使う場合:

1. `auth0 login`
2. `auth0 tenants list` でDEV tenantを確認する
3. `auth0 apps list` から `Re:Me DEV` のSPA `client_id` を確認する
4. `.env.local` に次を一度だけ設定する

```text
VITE_AUTH0_DOMAIN=<DEV tenant domain。https://なし>
VITE_AUTH0_CLIENT_ID=<Re:Me DEV client id>
```

5. `pnpm loop:preflight` はE2E credentialだけをtask worktreeへ同期する。Auth0 public valueは各環境へ明示的に設定する

Auth0 CLIのtokenはworktreeの `.config/auth0/` に書かれる場合があるが、gitignore済みや。

## Local Worker / D1

1. `.env.example` を `.env.local` へコピーする
2. DEV Auth0 public valuesを設定する
3. `pnpm exec wrangler d1 migrations apply re-me-local --local` を実行する
4. `pnpm dev:full` を起動する

初回のlocal Worker / R2 / Queue resourceは `wrangler.jsonc` のlocal bindingから作る。test-only headerとforce deliveryは `APP_ENV=local` の場合だけ有効や。Production / PreviewのWorkerがこのheaderを信用せえへんことをWorker testで確認する。

## Preview

Previewのresource、GitHub environment、Auth0 callbackは [preview-environment.md](preview-environment.md) を正とする。Preview D1へproduction exportを入れない。Preview Worker secretは `CAPABILITY_SECRET`、`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`を対象環境へ登録し、値はログへ出さへん。

## E2E

通常E2EはGoogle OAuth UIを毎回通さず、Auth0 database test identityでUniversal Loginを完了する。Playwrightは `storageState` を `e2e/.auth/` に保存し、Auth0 callback → Worker JWT検証 → `/api/users/ensure` → authenticated APIを検証する。

最低限:

- authenticated local / Preview session → draft → send
- sealed letter arrival → open
- open → reply → send to future
- ownership denial、sealed content denial、photo capability expiration

Google OAuth自体は少数のsmoke testで検証し、critical E2Eへ毎回含めない。

## 移行完了条件

- Worker API / D1 authorization / R2 capability / Cron / QueueがPreviewで動く
- Convex exportのchecksum、row count、R2 inventoryが取得済み
- local / Previewでimport、rerun、rollbackをリハーサル済み
- Production D1 / R2へHuman Gate付きで実データを投入済み
- Production URLでAuth0、draft→send、open、reply、notificationをsmoke済み
- rollback window終了後にのみlegacy Convex / credential / unused resourceを別PRでcleanupする
