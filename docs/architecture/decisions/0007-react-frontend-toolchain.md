# ADR-0007: React + Vite + React Router + TanStack Query をフロントエンド基盤にする

- 状態: 採用
- 日付: 2026-08-20
- 置換対象: [ADR-0004](0004-frontend-toolchain.md)
- 改訂: [ADR-0009](0009-auth0-convex-cloudflare.md)

> 現在の解釈: React / Vite / React Router / Mantine の決定だけが現行。以下の TanStack Query / Supabase / Hono / Worker backend に関する記述は当時の文脈であり、ADR-0009 により置き換えられた。

## 背景

Re:Me はモバイルファースト Web App / PWA として、当時は Cloudflare Worker + Hono、Supabase Auth / PostgreSQL + RLS、Cloudflare R2 を backend / インフラの基盤としていた。

当初は Vue 3 を frontend framework に採用したが、本格的な feature 実装へ入る前に frontend 層を再評価した。

既存の backend 構成は維持したまま、以下を満たす frontend 基盤が必要だった。

- React の生態系を使う
- Vite / Cloudflare Vite plugin の開発体験を維持する
- ルーティングを明示的に分離する
- Supabase / Worker のサーバー状態を component の local state から分離する
- モバイルファースト UI と PWA / アニメーションの拡張余地を持つ
- TypeScript / Oxc / Vitest / Playwright の品質ゲートを維持する

## 決定

frontend の標準を以下とする。

- React + TypeScript
- Vite
- `@vitejs/plugin-react`
- React Router
- TanStack Query
- pnpm
- `@cloudflare/vite-plugin`
- Oxlint
- Oxfmt
- `tsc --noEmit`
- Vitest + React Testing Library
- Playwright

Backend / 認証 / hosting の責務は ADR-0009 で Auth0 + Convex + Cloudflare に変更した。React / Vite / React Router / Mantine の選定は維持するが、Convex data に TanStack Query を重ねない。

## 責務の境界

### React

UI の組み立てとユーザー操作を担当する。

component に Supabase query / Worker request / 複雑なドメインロジックを大量に直書きしない。

### React Router

- URL / 画面遷移
- ルートの組み立て
- 認証が必要なルートの UX 上の redirect

認可の正本にはしない。当時は RLS / 信頼できる RPC / Worker 認可を必ず併用する、としていた。

### TanStack Query

当時は Supabase / Worker のサーバー状態を管理する、としていた。

- query
- mutation
- cache
- retry
- loading / error
- mutation 後の invalidation / refetch

Supabase Auth session、フォーム状態、モーダル状態などの client state は TanStack Query cache に入れない。

### Supabase Auth

当時は session の正本としていた。

application provider で session 復元 / 認証状態変化を扱い、React Router と TanStack Query はその状態を参照する、としていた。

## React を選んだ理由

- UI / PWA / アニメーション / テストを含む生態系が広い
- React Router と TanStack Query でルーティング / サーバー状態の責務を明示しやすい
- Mantine を UI 基盤として採用できる
- feature 実装がまだ薄く、Vue からの移行コストが低い段階で切り替えられる
- backend / DB のセキュリティ構成を変えず frontend 層だけを置き換えられる

## TanStack Query を選んだ理由（当時）

Re:Me は当時、ブラウザから RLS 保護された Supabase query を行う処理と、Worker API を経由する特権 / ストレージ処理を持っていた。

これらの remote 状態を React component の effect / local state へ散在させず、query / mutation / cache invalidation として共通化する、という意図だった。

TanStack Query は認可境界ではなく、client 側のサーバー状態オーケストレーションである。RLS / Worker 認可を置き換えない。

## Oxc / TypeScript

- Oxlint: lint
- Oxfmt: format（`endOfLine: "lf"`。Windows でも CRLF に正規化しない）
- TypeScript: `tsc --noEmit` で typecheck

ESLint / Prettier を同じ責務で重複導入しない。

## 帰結

- Vue / Vue Router / `vue-tsc` / Vue Test Utils を新規実装で使用しない
- React Router をルーティングの標準とする
- サーバー状態は当時 TanStack Query を標準としていた（現行は ADR-0009 により Convex reactive query）
- Redux / Zustand 等の client state library は必要性が出るまで追加しない
- React component test は React Testing Library を標準とする
- 既存の Vue scaffold は feature 実装を進める前に React へ移行する
- 当時は Cloudflare Worker / Hono / Supabase / R2 / Cron の設計を維持する、としていた
