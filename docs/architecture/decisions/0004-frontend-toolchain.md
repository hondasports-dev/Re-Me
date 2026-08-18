# ADR-0004: Vue + Vite + pnpm + Oxc をフロントエンド基盤にする

- Status: Accepted
- Date: 2026-08-18

## Context

Re:Me はモバイルファースト Web App / PWA として開始する。

要件:

- Vue を使う
- Vite を使う
- pnpm を使う
- lint / format は Oxc 系へ寄せる
- Cloudflare Worker と開発体験を統合したい
- TypeScript の型安全性は維持したい

## Decision

以下を標準とする。

- Vue 3 + TypeScript
- Vite
- pnpm
- `@cloudflare/vite-plugin`
- Oxlint
- Oxfmt
- `vue-tsc --noEmit`
- Vue Router
- Hono on Cloudflare Worker

## Why

### Vite

SPA 開発と Cloudflare Worker runtime integration を同じ toolchain に寄せられる。

### Oxc

lint / format を高速な Oxc toolchain へ一本化し、ESLint / Prettier の二重管理を避ける。

ただし Oxc を TypeScript type checker の代替にはしない。Vue SFC を含む型検査は `vue-tsc` を独立した CI gate とする。

### pnpm

workspace 拡張の余地を残しつつ、依存関係と lockfile を一つに固定する。

### Hono

Worker の HTTP route と scheduled handler を小さく整理しやすい。Frontend framework と Worker framework を混ぜず、Vue は UI、Hono は server boundary とする。

## Consequences

- ESLint / Prettier を原則追加しない
- `pnpm-lock.yaml` 以外の lockfile を許可しない
- `lint` が通っても type-safe とは限らないため `typecheck` を別に必須化する
- Cloudflare 固有処理は `worker/` に隔離する
- package major は実装開始時 stable を lockfile で固定する
