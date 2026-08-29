# ADR-0004: Vue + Vite + pnpm + Oxc をフロントエンド基盤にする

- 状態: 廃止
- 日付: 2026-08-18
- 後継: [ADR-0007: React + Vite + React Router + TanStack Query をフロントエンド基盤にする](0007-react-frontend-toolchain.md)

## 背景

Re:Me はモバイルファースト Web App / PWA として開始するにあたり、当初は Vue 3 を中心としたフロントエンド基盤を採用した。

当初の要件:

- Vue を使う
- Vite を使う
- pnpm を使う
- lint / format は Oxc 系へ寄せる
- Cloudflare Worker と開発体験を統合したい
- TypeScript の型安全性は維持したい

## 当時の決定

以下を標準としていた。

- Vue 3 + TypeScript
- Vite
- pnpm
- `@cloudflare/vite-plugin`
- Oxlint
- Oxfmt
- `vue-tsc --noEmit`
- Vue Router
- Hono on Cloudflare Worker

## 廃止した理由

本格的な feature 実装へ入る前にフロントエンド基盤を再評価し、React ecosystem を採用する方針へ変更した。

主な理由:

- React Router / TanStack Query を明示的な routing / server-state 基盤として採用したい
- Mantine を UI / accessibility 基盤として利用したい
- React ecosystem の UI / PWA / animation / testing 周辺の選択肢を活かしたい
- 既存 Vue 実装がまだ薄く、移行コストが低い段階で切り替えられる
- Cloudflare Worker / Hono / Supabase / R2 の backend architecture は変更せず、frontend layer だけを置き換えられる

## 当時の帰結

この ADR の Vue 固有の決定は新規実装へ適用しない。

引き続き有効な方針:

- Vite
- pnpm
- Cloudflare Vite plugin
- Oxlint / Oxfmt
- Hono on Cloudflare Worker
- `pnpm-lock.yaml` を唯一の lockfile とする

現在のフロントエンド判断は ADR-0007 を正とする。
