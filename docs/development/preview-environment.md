# Local / Preview 環境

この手順は Local と共有 Preview だけを対象にする。Production の Auth0 tenant、Google OAuth client、Convex deployment、Cloudflare Worker、domain、secret は別 Issue で扱い、この手順から作成・更新しない。

## 環境の境界

| 境界 | Local | Preview / CI E2E |
|---|---|---|
| Auth0 | DEV tenant / SPA application | 同じ DEV SPA application + Preview callback |
| Convex | マシン上の local backend（無料枠に乗らない） | 共有 Preview deployment（remote） |
| Cloudflare | Vite + local Worker runtime | `re-me-preview` Worker（`workers.dev`） |
| 非公開写真 bucket | `re-me-dev-attachments` | `re-me-preview-attachments` |
| ブラウザ設定 | `.env.local`（`VITE_CONVEX_URL` は local URL） | `.env.preview.local` / GitHub `preview` environment の変数 |
| 秘密情報 | local の ignore ファイル / local deployment の env | `.env.convex-preview.local` / deployment 限定の GitHub environment secret |

Production の credential や production deploy key を Local / Preview へ流用しない。Preview 用 Convex deploy key は共有 Preview deployment だけ、Cloudflare API token は対象アカウントの `Workers Scripts: Edit` だけに限定する。

現在の共有 Preview は次を使う。

```text
Cloudflare Worker: https://re-me-preview.hondasports.workers.dev
Convex deployment: cautious-chihuahua-383
Convex URL:        https://cautious-chihuahua-383.convex.cloud
Auth0 application: Re:Me DEV
GitHub environment: preview
```

## Convex の使い分け

無料枠を食い潰さないため、日常開発は cloud の個人 developer deployment を正本にしない。

| 作業 | 使う Convex | 起動 / デプロイ |
|---|---|---|
| `pnpm dev:full` / `pnpm convex:dev` | このマシンの local backend。`VITE_CONVEX_URL` は `http://127.0.0.1:3210` 系 | `convex deployment select local` のあと backend が立ち上がる。止めると backend も止まる |
| `pnpm convex:check` | 同じ local backend | cloud へは push しない |
| `pnpm test` / CI 品質ゲート | live Convex は使わない。`convex-test` の in-memory harness | deploy しない |
| CI E2E | 共有 Preview（`cautious-chihuahua-383`） | Playwright の前に `CONVEX_PREVIEW_DEPLOY_KEY` で `convex deploy` |
| 手動 Preview Worker | 同じ共有 Preview | `preview.yml`。E2E と `shared-preview-backend` で直列 |
| Production | production deployment | PR CI と local からは実行しない |

どうしても cloud の developer deployment を触る場合だけ `CONVEX_ALLOW_CLOUD_DEV=1` を付ける。wrapper は先に `deployment select dev` するので、直前の local 選択は残らない。CI の repository 変数 `VITE_CONVEX_URL`（個人 DEV）は正本にしない。GitHub environment `preview` の URL と deploy key を使う。

## Local

1. `.env.example` を `.env.local` へコピーする。
2. `VITE_AUTH0_DOMAIN` と `VITE_AUTH0_CLIENT_ID` を DEV の値で設定する。`VITE_CONVEX_URL` は空のままでよい。
3. 初回は `pnpm exec convex deployment create local --select`。以降の `pnpm convex:dev` / `pnpm dev:full` は local deployment を選んでから backend を起動する。新しい task worktree で anonymous mode になる場合は下の「Task worktree の local Convex」を使う。
4. local backend が動いている間に `AUTH0_DOMAIN` と `AUTH0_CLIENT_ID` を `pnpm exec convex env set` で設定する。
5. 非公開 DEV R2 bucket に限定した Object Read & Write credential を作り、`R2_BUCKET`、`R2_ENDPOINT`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` を同じ local deployment に設定する。
6. `pnpm dev:full` を実行する。

`pnpm dev:full` は local Convex backend を同期しながら Vite を起動する。cloud の developer deployment は起動しない。ブラウザは `http://127.0.0.1:5173` を使い、Auth0 DEV SPA application には次を登録する。

```text
Allowed Callback URLs: http://127.0.0.1:5173/auth/callback
Allowed Logout URLs:   http://127.0.0.1:5173
Allowed Web Origins:   http://127.0.0.1:5173
```

## Task worktree の local Convex

新しい git worktree は canonical checkout と `.convex/` も `CONVEX_DEPLOYMENT` も共有しない。`pnpm loop:preflight` がコピーするのは `E2E_AUTH0_*` だけである。Convex CLI の login（`~/.convex/config.json`）はマシン共通なので、worktree ごとに `npx convex login` し直す必要はない。

worktree で素の `pnpm exec convex deployment create local --select` を叩くと、project がまだ紐づいていないため CLI が anonymous mode と判定して失敗することがある。ログイン済みでも同じ。cloud の developer deployment を worktree の正本にコピーして使わない。

手順は次のとおり。値は表示・commit しない。

1. `pnpm exec convex login status` で Logged in を確認する。切れていれば自分のターミナルで `pnpm exec convex login` する。
2. canonical `.env.local` の `CONVEX_DEPLOYMENT` が `dev:` であることを確認する。`:` の後ろは空白で分割した **最初のトークンだけ** を deployment 名として使う。コメントや余分な文字列が付いている場合がある。
3. その `dev:<name>` を **この1コマンドの環境変数としてだけ** 渡し、worktree で local を作る。作成後の向き先は local（だいたい `http://127.0.0.1:3210`）であり、canonical の cloud URL を `.env.local` に残さない。

```powershell
# task worktree で実行。$canonical は `git worktree list` の最初の worktree 行（canonical checkout）
$canonical = (git worktree list --porcelain | Where-Object { $_ -like 'worktree *' } | Select-Object -First 1).Substring(9)
$line = Get-Content "$canonical\.env.local" | Where-Object { $_ -match '^CONVEX_DEPLOYMENT=' } | Select-Object -First 1
$raw = $line.Substring('CONVEX_DEPLOYMENT='.Length).Trim().Trim('"').Trim("'")
$kind, $rest = $raw.Split(':', 2)
$name = ($rest.Trim() -split '\s+')[0]
if ($kind.Trim() -ne 'dev' -or [string]::IsNullOrWhiteSpace($name)) {
  throw 'canonical CONVEX_DEPLOYMENT is not kind=dev'
}
$env:CONVEX_DEPLOYMENT = "dev:$name"
pnpm exec convex deployment create local --select
Remove-Item Env:CONVEX_DEPLOYMENT
```

```bash
canonical=$(git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }')
line=$(grep '^CONVEX_DEPLOYMENT=' "$canonical/.env.local" | head -n1)
raw=${line#CONVEX_DEPLOYMENT=}
raw=$(printf '%s' "$raw" | tr -d "\"'" | awk '{ print $1 }')
kind=${raw%%:*}
name=${raw#*:}
[ "$kind" = "dev" ] && [ -n "$name" ] || { echo 'canonical CONVEX_DEPLOYMENT is not kind=dev' >&2; exit 1; }
CONVEX_DEPLOYMENT="dev:$name" pnpm exec convex deployment create local --select
```

4. ブラウザ用の `VITE_AUTH0_DOMAIN` / `VITE_AUTH0_CLIENT_ID` を canonical `.env.local` から worktree `.env.local` へ入れる。`pnpm loop:preflight` はこれをコピーしない。同じ公開値を local Convex へは `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` として `pnpm exec convex env set --force --deployment local --from-file <一時ファイル>` する。一時ファイルは直後に消す。local の返信 / 開封 E2E で「E2E: 今すぐ届ける」を使うなら `pnpm exec convex env set E2E_FORCE_DELIVERY 1 --deployment local` も必要。production には置かない。R2 の4値は既存の local 手順どおり、必要なときだけ同じ local deployment へ `convex env set` する。R2 を `.env.local` へ複製しない。
5. 親プロセスに cloud の `CONVEX_DEPLOYMENT` が残っていると `.env.local` の local 選択を上書きするので、unset してから `pnpm convex:check` する。

```powershell
Remove-Item Env:CONVEX_DEPLOYMENT -ErrorAction SilentlyContinue
pnpm convex:check
```

Agent の非対話シェルでは step 3 が再び anonymous 扱いになりうる。その場合は人間のターミナルで同じ手順を実行する。`CONVEX_ALLOW_CLOUD_DEV=1` は付けない。

## 共有 Preview の立ち上げ

1. Convex project に共有 Preview deployment を作る。
2. Preview deployment に限定した deploy key を作る。
3. `AUTH0_DOMAIN` と `AUTH0_CLIENT_ID` を Preview deployment 種別の default 環境変数に設定する。
4. 非公開 Preview R2 bucket に限定した Object Read & Write credential を作り、同じ4個の `R2_*` 値を Preview deployment にだけ設定する。
5. `.env.preview.example` を `.env.preview.local` へコピーし、DEV Auth0 と Convex URL のブラウザ公開値を設定する。
6. `.env.convex-preview.example` を `.env.convex-preview.local` へコピーし、Preview deploy key だけを設定する。
7. `pnpm deploy:preview` を実行する。
8. 出力された `https://re-me-preview.<subdomain>.workers.dev` を Auth0 DEV SPA application に登録する。

Auth0 の設定値は次の形にする。

```text
Allowed Callback URLs: https://re-me-preview.<subdomain>.workers.dev/auth/callback
Allowed Logout URLs:   https://re-me-preview.<subdomain>.workers.dev
Allowed Web Origins:   https://re-me-preview.<subdomain>.workers.dev
```

Preview callback は固定 Worker URL だけを許可する。版付き Preview URL の wildcard は Auth0 callback に登録しない。

## 非公開 R2 写真 bucket

bucket は公開アクセスと custom domain を無効のままにし、環境ごとに credential を分ける。

| Bucket | 許可する origin |
|---|---|
| `re-me-dev-attachments` | `http://127.0.0.1:5173`, `http://localhost:5173`, `http://127.0.0.1:4173`, `http://localhost:4173` |
| `re-me-preview-attachments` | `https://re-me-preview.hondasports.workers.dev`, `http://127.0.0.1:4173`, `http://localhost:4173` |

CI E2E の frontend は Playwright の `vite preview`（`http://127.0.0.1:4173`）で、backend / 写真 bucket は共有 Preview を使う。そのため Preview bucket の CORS には Worker origin だけでなく Playwright origin も入れる。正本は `ops/r2-cors-preview.json`。反映は次で行う。

```text
pnpm exec wrangler r2 bucket cors set re-me-preview-attachments --file ops/r2-cors-preview.json --force
```

CORS は両 bucket とも次だけを許可する。

```text
Methods: PUT, GET, HEAD
Allowed headers: Content-Type, Content-Length, If-None-Match
Expose headers: ETag
Max age: 3600 seconds
```

R2 API token は対象 bucket の Object Read & Write に限定する。DEV credential を Preview に、Preview credential を local deployment に設定しない。Production bucket / token / Convex env は Issue #38 で扱い、この手順では作成しない。

両 bucket に `staging/` prefix を1日後に削除する lifecycle rule を設定する。通常は Convex が署名 URL 失効5分後と15分 cron で staging object を削除し、lifecycle rule は処理中断時の取り残しだけを回収する。

写真 upload の実動確認では、JPEG / PNG / WebP を各1枚添付し、R2 object が非公開であること、Convex の `letterAttachments` が `ready` になること、別ユーザーおよび封をした未開封手紙から60秒 URL を取得できないことを確認する。

## GitHub `preview` environment

CI の End-to-end job は GitHub environment `preview` の `VITE_CONVEX_URL` と `CONVEX_PREVIEW_DEPLOY_KEY` を使い、Playwright の前に PR の Convex functions を共有 Preview へ `convex deploy` する。受信箱 E2E は配送 cron を待たず、Preview Convex にだけ `E2E_FORCE_DELIVERY=1` を置いて所有者の traveling letter を同じ配送経路で届ける。production にはこの変数を置かない。品質ゲート job は live Convex に触れず `pnpm test:convex` だけを使う。repository 変数の `VITE_CONVEX_URL`（個人 developer deployment）は CI の正本にしない。

`main` へ merge するには ruleset `protectmain` の required checks `Quality gates` と `End-to-end` が両方 SUCCESS である必要がある。workflow に job を足したら ruleset の context 名も同じものを足す。

共有 Preview Convex は1つなので、CI E2E と手動 Preview deploy は `shared-preview-backend` concurrency で直列化する。E2E 実行中は Preview backend が当該 PR の functions になる。Cloudflare Preview Worker の frontend は手動 `preview.yml` まで古いままになり得る。

`.github/workflows/preview.yml` は Cloudflare Worker への手動実行だけに限定する。GitHub environment `preview` に以下を設定する。

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

`CLOUDFLARE_API_TOKEN` は account resource を `Hondasports@gmail.com's Account`、権限を `Workers Scripts: Edit` のみにする。Production 用 token や広い Cloudflare template token は使わない。

Workflow は secret を渡さず frontend を build してから、step 単位で Convex key と Cloudflare token をそれぞれ必要な deploy だけへ渡す。最後に Convex の health query、Worker の health endpoint、SPA fallback を確認する。

## 復旧

- frontend 失敗: Cloudflare Worker の直前 version へ rollback する。
- backend 失敗: Preview deployment を作り直し、deployment 限定 key を再発行する。
- credential 漏洩: 該当する Preview key/token だけを無効化し、DEV / Production credential は巻き込まない。
- R2 upload 失敗: 対象環境の bucket CORS と4個の Convex `R2_*` 値を確認し、誤 credential は無効化 / 再発行する。`deleting` attachment は15分 cron が再試行する。
- Auth0 callback エラー: Preview URL の3項目だけを DEV SPA application から外す。

Production への deploy、DNS、custom domain、production Auth0 / Google OAuth、production Convex の data / schema はこの手順の対象外。
