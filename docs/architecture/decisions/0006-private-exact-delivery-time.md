# ADR-0006: 正確な到着日時を public schema に置かない

- Status: Accepted
- Date: 2026-08-18
- Amended by: [ADR-0009](0009-auth0-convex-cloudflare.md)

## Context

Re:Me ではユーザーが「数日後くらい」「数か月後くらい」「未来に任せる」を選び、正確な到着日時は分からないこと自体が体験の一部になる。

`scheduled_at` を RLS で本人 SELECT 可能な `letters` に置くと、UI で非表示にしても API / DevTools から正確な日時を取得できる。

## Decision

- public `letters` には `delivery_window_start/end` のみを保存する
- exact `scheduledAt` は Convex の delivery document に保存する
- `sendLetter` mutation が exact time を決定する
- Convex cron / internal mutation が due letter を処理する
- authenticated client へ exact time を返さない

## Why

これは強い秘密情報を隠すためではなく、プロダクトの約束をデータ境界でも守るため。

UI 実装ミスや client query の都合で exact time が露出しにくくなる。

## Consequences

- Browser だけで due 判定はできない
- trusted Convex function が必須になる
- function return validator / authorization test で authenticated client から exact time を取得できないことを検証する
