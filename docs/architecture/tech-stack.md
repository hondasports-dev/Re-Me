# 技術スタック

## 採用するスタック

| 層 | 技術 | 責務 |
|---|---|---|
| Runtime | Node.js 24 LTS | ローカル tooling / CI |
| パッケージ管理 | pnpm | 依存関係 / script 管理 |
| フロントエンド | React + TypeScript + Vite | モバイルファースト SPA / PWA |
| ルーティング | React Router | URL / 画面遷移 / login UX |
| UI | Mantine + Re:Me design system | 操作 UI のアクセシビリティ基盤 / ブランド UI |
| 認証 | Auth0 + Google OAuth | Universal Login、token / session |
| API / backend | Cloudflare Worker + Hono | JWT 検証、認可、ドメイン処理、HTTP API |
| Database | Cloudflare D1 | domain data、private schedule、outbox |
| File storage | private Cloudflare R2 | 写真 object |
| Async processing | Cloudflare Scheduled Worker + Queues | 配送 sweep、通知 retry、attachment reconcile |
| Client data | HTTP API + TanStack Query | server state の取得・cache・mutation |
| Hosting | Cloudflare Workers Static Assets | SPA / PWA、CDN、edge 保護 |
| Toolchain | Oxlint + Oxfmt + `tsc --noEmit` | lint / format / typecheck |
| Test | Vitest + React Testing Library + Playwright | unit / Worker integration / E2E |

## 原則として入れないもの

- Supabase Auth / runtime PostgreSQL / RLS client path
- ブラウザからの D1 / R2 直接アクセス
- generic な状態 patch API
- 必要性が出る前の Redux / Zustand
- Oxc 系と並べて入れる ESLint / Prettier

`supabase/migrations/` は過去 schema の比較 artifact として残るが、runtime の
接続先や通常品質ゲートではない。

## フロントエンドの provider

```text
QueryClientProvider
  └─ MantineProvider
      └─ ApiClientProvider
          └─ Auth0Provider
              └─ LiveAuthRuntimeProvider
                  └─ React Router
```

`useAuth0()` は login / logout / identity を担当し、`LiveAuthRuntimeProvider` は
Auth0 access token を API client へ渡す。server state は feature hook と TanStack
Query に閉じ込め、global store へ複製しない。

## Worker API のルール

- request / response の境界で入力と返却値を検証する
- 認証が必要な route は Auth0 JWT を検証し、D1 の内部 user と所有権を解決する
- 状態遷移は専用 domain function と D1 transaction に限定する
- exact `scheduledAt`、R2 object key、notification secret を browser response に含めない
- 外部副作用は durable な D1 state と outbox を先に記録する
- scheduled / queue handler は再実行されても二重到着・二重通知を起こさない

## Cloudflare の方針

`wrangler.jsonc` の各 environment を deploy 単位とする。

- `assets.not_found_handling = "single-page-application"`
- `/api/*` は Worker が先に処理する
- D1 migrations は numbered SQL を正本とする
- Local / Preview / Production の Worker、D1、R2、Queue、secret は分離する
- Production deploy は `pnpm deploy:production` に限定し、未構築状態では実行しない

## R2 の方針

- bucket は非公開
- object metadata と所有権は D1 に保存する
- upload / download capability は Worker が発行し、短い TTL と owner / letter
  state を束縛する
- JPEG / PNG / WebP、サイズ、dimension、metadata を client と Worker の両方で検証する
- finalize は generation token と single-flight claim で冪等にする
- sealed / 未開封の attachment に対する download capability は発行しない
- 削除失敗は D1 の reconcile state と scheduled sweep で再試行する

## 配送・通知

Worker の `scheduled()` が due delivery を D1 から claim し、到着状態を確定して
通知 outbox を Queue へ送る。Queue consumer は push endpoint ごとに送信し、失敗は
job state と retry 時刻へ反映する。通知 payload は本文・写真・場所・正確な時刻を
含めない。

## 環境と legacy artifact

- Local: local Worker / D1 / R2 / Queue と Auth0 DEV
- Preview: `re-me-preview` Worker と専用 Cloudflare resources
- Production: `re-me` の設定はあるが、Auth0 PROD と Worker の初回 deploy は未実施
- `supabase/` は比較・履歴確認に限定し、新しい runtime client や Service Role path
  を追加しない

関連手順は [Local / Preview 環境](../development/preview-environment.md)、
[Production 環境](../development/production-environment.md) を参照する。
