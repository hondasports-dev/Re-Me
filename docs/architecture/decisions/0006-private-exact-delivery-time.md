# ADR-0006: 正確な到着日時を public schema に置かない

- Status: Accepted
- Date: 2026-08-18

## Context

Re:Me ではユーザーが「数日後くらい」「数か月後くらい」「未来に任せる」を選び、正確な到着日時は分からないこと自体が体験の一部になる。

`scheduled_at` を RLS で本人 SELECT 可能な `letters` に置くと、UI で非表示にしても API / DevTools から正確な日時を取得できる。

## Decision

- public `letters` には `delivery_window_start/end` のみを保存する
- exact `scheduled_at` は `private.letter_delivery` に保存する
- `send_letter` RPC が exact time を決定する
- Delivery Worker は Service Role 経由の RPC で due letter を処理する
- authenticated client へ exact time を返さない

## Why

これは強い秘密情報を隠すためではなく、プロダクトの約束をデータ境界でも守るため。

UI 実装ミスや client query の都合で exact time が露出しにくくなる。

## Consequences

- Browser だけで due 判定はできない
- Delivery Worker / Service Role が必須になる
- migration / test で authenticated client から exact time を取得できないことを検証する
