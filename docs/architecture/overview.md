# アーキテクチャ概要

## 方針

Re:Me は、モバイルファースト React SPA と Cloudflare Worker を一つの Vite 開発体験にまとめ、Auth / DB は Supabase へ委譲する。

```mermaid
flowchart TB
    U[Mobile Web / PWA]
    CF[Cloudflare Worker + Static Assets]
    API[Hono /api]
    SA[Supabase Auth]
    DB[Supabase PostgreSQL + RLS]
    R2[Cloudflare R2]
    CRON[Cloudflare Cron Trigger]
    OUTBOX[Notification Outbox]
    PUSH[Web Push]

    U --> CF
    U --> SA
    U --> DB
    U --> API
    CF --> API
    API --> R2
    API --> DB
    CRON --> API
    API --> OUTBOX
    OUTBOX --> PUSH
```

## Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- Mantine + custom Re:Me design tokens / components
- Supabase JS client

責務の分離:

- React Router: route / navigation / auth-required route の UX 制御
- TanStack Query: Supabase / Worker から取得する server state と mutation 後の invalidation
- Supabase Auth session: application provider で復元・購読
- React local state / context: form state と小さな UI state
- Mantine: accessibility を含む操作 UI の基盤
- Re:Me custom components: 手紙・封筒・開封・時間軸などのブランド体験

詳細: [技術スタック](tech-stack.md) / [プロジェクト構成](project-structure.md)

## Cloudflare

新規アプリは Worker をデプロイ単位とする。

Worker の責務:

- SPA static assets
- Hono `/api/*`
- R2 photo upload / delete
- Supabase service role が必要な privileged operation
- scheduled handler
- delivery / notification jobs

`fetch` と `scheduled` を同じ Worker entry point から提供する。

## Supabase

責務:

- Social Login
- PostgreSQL
- RLS
- thread / letter / content / notification metadata
- trusted RPC

Browser から Supabase を直接利用する場合も RLS を前提とする。

## Trust boundary

### Browser から直接許可

- 自分の letter metadata SELECT
- RLS 上閲覧可能な本文 SELECT
- draft 本文 autosave
- draft attachment metadata の限定操作
- user settings
- push subscription

TanStack Query はこの認可境界を置き換えない。query / mutation が発行する Supabase request も通常 client credential と RLS の制約下で動かす。

### Trusted RPC

- draft / thread 作成
- 送信
- 開封
- 削除

### Worker + Service Role

- exact schedule
- `traveling -> delivered`
- notification outbox
- R2 private object
- 管理・保守処理

## Exact delivery time

`scheduled_at` は public `letters` に保存しない。

```text
public.letters
  delivery_window_start/end  <- ユーザーが見てよい

private.letter_delivery
  scheduled_at               <- Worker / service role のみ
```

「数か月後くらい」という体験を API contract 自体で守る。

## Environments

MVP 初期:

- Local / DEV
- Production

### Local / DEV

- React / Vite local dev server
- Cloudflare Worker local runtime
- Supabase CLI local PostgreSQL
- Supabase CLI local Auth (GoTrue)
- local Google OAuth client は必要な smoke test のみで利用

通常の automated E2E は Google の UI へ依存せず、local Supabase Auth のテストユーザー / session を使用する。

### Production

- Cloudflare Worker + static assets
- Supabase Cloud project
- production Google OAuth client

Supabase migration は local / production に同じ履歴を適用し、Dashboard の手変更を source of truth にしない。

利用者・変更リスクが増え、クラウド上の Preview / Staging が必要になった時点で追加環境と費用を再評価する。

## Free tier policy

無料枠は MVP 検証に利用するが、無料枠の制約をプロダクト仕様にしない。

クラウド Supabase project を DEV / PROD のためだけに二重化せず、日常開発は local stack を基準にする。

Re:Me は長期間アクセスされないことが正常なので、公開前に以下を再確認する。

- DB / Auth の休止条件
- Cron / Worker limit
- R2 storage / operation limit
- 通知到達性
- バックアップ / 復旧
