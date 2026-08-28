# ADR-0006: 正確な到着日時を public schema に置かない

- 状態: 採用
- 日付: 2026-08-18
- 改訂: [ADR-0009](0009-auth0-convex-cloudflare.md)

## 背景

Re:Me ではユーザーが「数日後くらい」「数か月後くらい」「未来に任せる」を選び、正確な到着日時は分からないこと自体が体験の一部になる。

`scheduled_at` を RLS で本人 SELECT 可能な `letters` に置くと、UI で非表示にしても API / DevTools から正確な日時を取得できる。

## 決定

- 公開する `letters` には `delivery_window_start/end` のみを保存する
- 正確な `scheduledAt` は Convex の delivery document に保存する
- `sendLetter` mutation が正確な時刻を決定する
- Convex cron / internal mutation が期限到来した手紙を処理する
- 認証済み client へ正確な時刻を返さない

## 理由

これは強い秘密情報を隠すためではなく、プロダクトの約束をデータ境界でも守るため。

UI 実装ミスや client query の都合で正確な時刻が露出しにくくなる。

## 帰結

- ブラウザだけで期限判定はできない
- 信頼できる Convex function が必須になる
- function の return validator / 認可テストで、認証済み client から正確な時刻を取得できないことを検証する
