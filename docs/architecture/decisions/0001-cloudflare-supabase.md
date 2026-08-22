# ADR-0001: Cloudflare + Supabase を MVP 基盤にする

- Status: Superseded by [ADR-0009](0009-auth0-convex-cloudflare.md)
- Date: 2026-08-18

## Context

Re:Me はモバイルファースト Web アプリとして小さく MVP を検証したい。一方、Social Login / PostgreSQL / RLS を自前実装しすぎたくない。

## Decision

- Hosting / Workers / Cron / R2: Cloudflare
- Auth / PostgreSQL / RLS: Supabase

## Consequences

- 二つのサービスを運用する
- 認証トークンを Worker / Browser でどう扱うか設計が必要
- 無料枠の休止・上限を本番要件として信用しない
- 本番公開前に Supabase 側の可用性条件を再評価する
