# Production 環境

この文書は [Issue #38](https://github.com/hondasports-dev/Re-Me/issues/38) の **構成手順** である。チェックリストは [production-readiness.md](production-readiness.md)。Local / Preview は [preview-environment.md](preview-environment.md)。

**この文書を読んでも Auth0 / Convex / Cloudflare の本番リソースは作らない。** 作成・DNS・production deploy・OAuth production client は Human Gate。いまの slice は手順と GitHub isolation だけである。

## いまの状態

| 境界 | 状態 |
|---|---|
| GitHub environment `production` | 空の environment は作成済み。variable / secret の値はまだ置かない。required reviewers は Human Gate で付ける |
| Auth0 PROD tenant / SPA | 未作成 |
| Google OAuth production client | 未作成 |
| Convex production deployment | 未作成 |
| Cloudflare production Worker | 未作成。設定上の名前だけ `wrangler.jsonc` の `env.production`（Worker 名 `re-me`） |
| Cloudflare production D1 | 未作成。設定上の database 名だけ `re-me` |
| Cloudflare production notification Queue | 未作成。設定上の queue 名だけ `re-me-production-notifications` |
| custom domain | 初回リリースの必須ではない |

## 公開 URL（初回）

Auth0 custom domain は必須にしない。Preview と別の `workers.dev` を使う。

```text
Production: https://re-me.hondasports.workers.dev
Preview:    https://re-me-preview.hondasports.workers.dev
```

Production の Allowed Callback / Logout / Web Origin は Production URL だけにする。Preview / localhost を混ぜない。

## GitHub environment `production`

PR CI（`ci.yml`）と Preview（`preview.yml`）は environment `preview` のままにする。`production` を PR や `push` to `main` から参照しない。

GitHub で environment 名 `production` を作り、required reviewers を付ける。この environment に Preview の deploy key を入れない。

Variables（名前だけ。値は Human Gate 後）:

```text
CLOUDFLARE_ACCOUNT_ID
PRODUCTION_BASE_URL
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_CONVEX_URL
```

`PRODUCTION_BASE_URL` の初回値は `https://re-me.hondasports.workers.dev`。`VITE_*` は **PROD** Auth0 / Convex の公開値であり、DEV / Preview と共有しない。

Secrets（名前だけ。値は Human Gate 後）:

```text
CLOUDFLARE_API_TOKEN
CONVEX_PRODUCTION_DEPLOY_KEY
```

- `CONVEX_PREVIEW_DEPLOY_KEY` を `production` に置かない
- `CONVEX_PRODUCTION_DEPLOY_KEY` を `preview` / Local / PR CI に置かない
- E2E Auth0 database の email / password を `production` に置かない
- token は `Workers Scripts: Edit` に限定し、Preview 用 token を流用しない

手元の Convex production key を置くなら `.env.convex-production.example` を `.env.convex-production.local` へコピーする。git にコミットしない。

## Auth0 / Google（Human Gate 後）

1. DEV とは別の PROD tenant を作る
2. SPA application 名は `Re:Me PROD`。DEV の `Re:Me DEV` を使わない
3. Google OAuth **production** client を DEV client から分離する。Authorized redirect URI は `https://<PROD-Auth0-domain>/login/callback`
4. Callback / Logout / Web Origin は Production URL だけ
5. Management API credential も Production 専用
6. DEV の test identity を production にコピーしない

ブラウザへ出すのは `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` だけ。client secret を `VITE_` にしない。

## Convex（Human Gate 後）

1. production deployment を developer / Preview から分離する
2. Convex 上の `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` は PROD SPA の公開値
3. deploy key は GitHub `production` の `CONVEX_PRODUCTION_DEPLOY_KEY` だけ
4. schema / data の変更は inventory / dry-run / rollback と Human Gate。PR CI からは production へ deploy しない
5. `E2E_FORCE_DELIVERY` を production に置かない

## Cloudflare / R2（Human Gate 後）

1. `pnpm exec wrangler deploy --env production` は Human Gate 後だけ。`wrangler deploy` 単体や `--env preview` で production Worker を更新しない
2. Worker 名は `re-me`。Preview の `re-me-preview` と共有しない
3. private R2 は `re-me-production-attachments`。DEV / Preview bucket に production 写真を入れない
4. D1 は `re-me`。schema は `migrations/` から適用し、Convex export / R2 copy / D1 import は [移行リハーサル手順](convex-d1-migration.md) と Human Gate を通す
5. notification Queue は `re-me-production-notifications`。Preview / Local の queue と共有しない
6. CORS origin は Production URL だけ

## Rollback

- Worker: 直前 version へ戻す。Preview Worker を production の代わりにしない
- Convex: Preview の data / functions を production に流し込まない。export の restore は Human Gate
- Auth0: ユーザー作成は rollback できないことがある。data を戻しても login が残る場合は記録する
- credential 漏洩: production key / token だけを無効化する。DEV / Preview を巻き込まない

data cutover は [legacy-migration.md](legacy-migration.md) の Human Gate。この文書の Worker 作成と混ぜない。

## Smoke（Human Gate 後）

本番に E2E Auth0 database login を常時載せない。作成直後だけ:

1. production Worker の `/api/health`
2. Auth0 PROD の login → Convex 認証済み query
3. rollback で health が残ること

evidence は Issue / PR に **値を貼らず**、実行した事実だけを残す。
