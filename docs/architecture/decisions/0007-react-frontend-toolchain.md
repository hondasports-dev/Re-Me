# ADR-0007: React + Vite + React Router + TanStack Query をフロントエンド基盤にする

- Status: Accepted
- Date: 2026-08-20
- Supersedes: [ADR-0004](0004-frontend-toolchain.md)
- Amended by: [ADR-0009](0009-auth0-convex-cloudflare.md)

> Current interpretation: React / Vite / React Router / Mantine の決定だけが現行。以下の TanStack Query / Supabase / Hono / Worker backend に関する記述は当時の context であり、ADR-0009 により superseded された。

## Context

Re:Me はモバイルファースト Web App / PWA として、Cloudflare Worker + Hono、Supabase Auth / PostgreSQL + RLS、Cloudflare R2 を backend / infrastructure の基盤としている。

当初は Vue 3 を frontend framework に採用したが、本格的な feature 実装へ入る前に frontend layer を再評価した。

既存の backend architecture は維持したまま、以下を満たす frontend 基盤が必要である。

- React ecosystem を利用する
- Vite / Cloudflare Vite plugin の開発体験を維持する
- routing を明示的に分離する
- Supabase / Worker の server state を component local state から分離する
- mobile-first UI と PWA / animation の拡張余地を持つ
- TypeScript / Oxc / Vitest / Playwright の quality gate を維持する

## Decision

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

Backend / auth / hosting の責務は ADR-0009 で Auth0 + Convex + Cloudflare に変更した。React / Vite / React Router / Mantine の選定は維持するが、Convex data に TanStack Query を重ねない。

## Responsibility boundaries

### React

UI composition と user interaction を担当する。

component に Supabase query / Worker request / complex domain logic を大量に直書きしない。

### React Router

- URL / navigation
- route composition
- auth-required route の UX 上の redirect

認可の source of truth にはしない。RLS / trusted RPC / Worker authorization を必ず併用する。

### TanStack Query

Supabase / Worker の server state を管理する。

- query
- mutation
- cache
- retry
- loading / error
- mutation 後の invalidation / refetch

Supabase Auth session、form state、modal state などの client state は TanStack Query cache に入れない。

### Supabase Auth

session の source of truth とする。

application provider で session restore / auth state change を扱い、React Router と TanStack Query はその状態を参照する。

## Why React

- UI / PWA / animation / testing を含む ecosystem が広い
- React Router と TanStack Query で routing / server state の責務を明示しやすい
- Mantine を UI 基盤として採用できる
- feature 実装がまだ薄く、Vue からの移行コストが低い段階で切り替えられる
- backend / DB security architecture を変更せず frontend layer だけを置き換えられる

## Why TanStack Query

Re:Me は Browser から RLS-protected Supabase query を行う処理と、Worker API を経由する privileged / storage 処理を持つ。

これらの remote state を React component の effect / local state へ散在させず、query / mutation / cache invalidation として共通化する。

TanStack Query は認可境界ではなく client-side server-state orchestration である。RLS / Worker authorization を置き換えない。

## Oxc / TypeScript

- Oxlint: lint
- Oxfmt: format
- TypeScript: `tsc --noEmit` で typecheck

ESLint / Prettier を同じ責務で重複導入しない。

## Consequences

- Vue / Vue Router / `vue-tsc` / Vue Test Utils を新規実装で使用しない
- React Router を routing の標準とする
- server state は TanStack Query を標準とする
- Redux / Zustand 等の client state library は必要性が出るまで追加しない
- React component test は React Testing Library を標準とする
- existing Vue scaffold は feature 実装を進める前に React へ移行する
- Cloudflare Worker / Hono / Supabase / R2 / Cron の設計は維持する
