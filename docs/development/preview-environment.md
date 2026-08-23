# Local / developer・Preview 環境

この手順は Local / developer と共有 Preview だけを対象にする。Production の Auth0 tenant、Google OAuth client、Convex deployment、Cloudflare Worker、domain、secret は別 Issue で扱い、この手順から作成・更新しない。

## Environment boundary

| Boundary | Local / developer | Preview |
|---|---|---|
| Auth0 | DEV tenant / SPA application | 同じ DEV SPA application + Preview callback |
| Convex | 個人 developer deployment | 共有 Preview deployment |
| Cloudflare | Vite + local Worker runtime | `re-me-preview` Worker on `workers.dev` |
| Browser config | `.env.local` | `.env.preview.local` / GitHub `preview` environment variables |
| Secrets | local ignored files / developer deployment | `.env.convex-preview.local` / deployment-scoped GitHub environment secrets |

Production credential や production deploy key を Local / Preview へ流用しない。Preview 用 Convex deploy key は共有 Preview deployment だけ、Cloudflare API token は対象 account の `Workers Scripts: Edit` だけに限定する。

現在の共有 Preview は次を使う。

```text
Cloudflare Worker: https://re-me-preview.hondasports.workers.dev
Convex deployment: cautious-chihuahua-383
Convex URL:        https://cautious-chihuahua-383.convex.cloud
Auth0 application: Re:Me DEV
GitHub environment: preview
```

## Local / developer

1. `.env.example` を `.env.local` へコピーする。
2. `VITE_AUTH0_DOMAIN`、`VITE_AUTH0_CLIENT_ID`、`VITE_CONVEX_URL` を DEV の値で設定する。
3. developer deployment に `AUTH0_DOMAIN` と `AUTH0_CLIENT_ID` を設定する。
4. `pnpm dev:full` を実行する。

`pnpm dev:full` は Convex developer deployment を同期しながら Vite を起動する。ブラウザは `http://127.0.0.1:5173` を使い、Auth0 DEV SPA application には次を登録する。

```text
Allowed Callback URLs: http://127.0.0.1:5173/auth/callback
Allowed Logout URLs:   http://127.0.0.1:5173
Allowed Web Origins:   http://127.0.0.1:5173
```

## Shared Preview bootstrap

1. Convex project に共有 Preview deployment を作る。
2. Preview deployment に限定した deploy key を作る。
3. `AUTH0_DOMAIN` と `AUTH0_CLIENT_ID` を Preview deployment type の default environment variables に設定する。
4. `.env.preview.example` を `.env.preview.local` へコピーし、DEV Auth0 と Convex URL の browser-visible values を設定する。
5. `.env.convex-preview.example` を `.env.convex-preview.local` へコピーし、Preview deploy key だけを設定する。
6. `pnpm deploy:preview` を実行する。
7. 出力された `https://re-me-preview.<subdomain>.workers.dev` を Auth0 DEV SPA application に登録する。

Auth0 の設定値は次の形にする。

```text
Allowed Callback URLs: https://re-me-preview.<subdomain>.workers.dev/auth/callback
Allowed Logout URLs:   https://re-me-preview.<subdomain>.workers.dev
Allowed Web Origins:   https://re-me-preview.<subdomain>.workers.dev
```

Preview callback は固定 Worker URLだけを許可する。versioned Preview URL の wildcard は Auth0 callback に登録しない。

## GitHub `preview` environment

`.github/workflows/preview.yml` は手動実行だけに限定する。GitHub environment `preview` に以下を設定する。

Variables:

```text
CLOUDFLARE_ACCOUNT_ID
PREVIEW_BASE_URL
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_CONVEX_URL
```

Secrets:

```text
CLOUDFLARE_API_TOKEN
CONVEX_PREVIEW_DEPLOY_KEY
```

`CLOUDFLARE_API_TOKEN` は account resource を `Hondasports@gmail.com's Account`、permission を `Workers Scripts: Edit` のみにする。Production 用 token や広い Cloudflare template token は使わない。

Workflow は secret を渡さず frontend を build してから、step 単位で Convex key と Cloudflare token をそれぞれ必要な deploy だけへ渡す。最後に Convex health query、Worker health endpoint、SPA fallback を確認する。

## Recovery

- frontend failure: Cloudflare Worker の直前 version へ rollback する。
- backend failure: Preview deployment を作り直し、deployment-scoped key を再発行する。
- credential exposure: 該当する Preview key/token だけを revoke し、DEV/Production credential は巻き込まない。
- Auth0 callback error: Preview URL の3項目だけを DEV SPA application から外す。

Production への deploy、DNS、custom domain、production Auth0/Google OAuth、production Convex data/schema はこの runbook の対象外。
