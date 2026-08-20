# Initial issues draft

このファイルは GitHub Issues 作成時の scope を固定するための補助資料。

## Foundation / React migration

既存 Vue / PrimeVue scaffold を React / TypeScript / Vite / React Router / TanStack Query / Mantine へ移行する。

完了条件:

- `App.vue` / Vue Router / PrimeVue / Vue Test Utils / `vue-tsc` 前提を除去
- React bootstrap / Router / QueryClient / MantineProvider を構成
- Cloudflare Vite plugin / Worker / Hono は維持
- Oxlint / Oxfmt / `tsc --noEmit` / Vitest / React Testing Library を標準化
- empty AppShell と Worker health check が local で動く
- local Supabase PostgreSQL / Auth (GoTrue) が起動する

## Supabase schema / RLS

既存 initial migration を local Supabase に適用し、generated database types と RLS test を追加する。

## Auth

Supabase Google OAuth、session restore、React Router の auth-required route、logout を実装する。

通常の automated E2E は local Supabase Auth の test user / session を使い、Google OAuth の実連携は smoke test として分離する。

## Design system / AppShell

画面リファレンスに合わせた Re:Me design tokens、Mantine theme、mobile navigation、base layout を実装する。

Mantine は操作 UI / accessibility の基盤として使い、手紙・封筒・開封・時間軸などのブランド表現は custom component とする。

## Compose / Draft

blank letter editor、autosave、delivery window / seal step までの draft UX を実装する。

Supabase / Worker の server state は TanStack Query hook + repository を経由し、component へ直接 query logic を散在させない。

## R2 Photo

private R2 upload / delete、client-side metadata stripping、attachment metadata を実装する。

## Send / Immutability

`send_letter` RPC を UI へ接続し、ritual confirmation と sent immutable UX を実装する。

## Traveling letters

未来を旅する手紙一覧、sealed/unsealed の閲覧差、delete UX を実装する。

## Delivery / Notification

Cron + delivery RPC + notification outbox + retry を実装する。

## Inbox / Open

到着一覧、未開封 / 開封済み、開封前画面、`open_letter` を実装する。

## Reply / Thread

一本道の返信 draft、未来へ再送信、時間経過を見せる thread UI を実装する。

## PWA / Push

installable PWA、Web Push permission / subscription、notification tap routing を実装する。

## CI / E2E

GitHub Actions quality gates と critical E2E を React stack に合わせて更新する。

- `tsc --noEmit`
- React Testing Library
- local Supabase Auth test session
- Playwright critical flow
- Google OAuth smoke test は通常 critical E2E と分離
