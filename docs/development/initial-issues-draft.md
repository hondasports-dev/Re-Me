# Initial issues draft

このファイルは GitHub Issues 作成時の scope を固定するための補助資料。

## Foundation

Vite / Vue / TypeScript / pnpm / Oxc / PrimeVue / Cloudflare Vite plugin / Hono / test toolchain を scaffold し、empty AppShell と Worker health check が local で動く。

## Supabase schema / RLS

既存 initial migration を local Supabase に適用し、generated database types と RLS test を追加する。

## Auth

Supabase Google OAuth、session restore、router guard、logout を実装する。

## Design system / AppShell

画面リファレンスに合わせた Re:Me design tokens、PrimeVue preset、mobile navigation、base layout を実装する。

## Compose / Draft

blank letter editor、autosave、delivery window / seal step までの draft UX を実装する。

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

GitHub Actions quality gates と critical E2E を実装する。
