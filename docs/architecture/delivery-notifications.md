# 手紙の配送・通知

## Delivery model

送信時に delivery mode → delivery window → `scheduled_at` の順で決定し、Letter を `traveling` にする。`scheduled_at` は一度だけ決める。

## Example ranges

| UI | 初期案 |
|---|---|
| 数日後くらい | 3〜7日 |
| 数週間後くらい | 14〜30日 |
| 数か月後くらい | 60〜180日 |
| 1年後くらい | 300〜430日 |
| 未来に任せる | TBD |

## Cron

Cloudflare Cron Trigger から Delivery Worker を定期実行する。

```text
find letters
where status = traveling
and scheduled_at <= now
and deleted_at is null
```

対象を `delivered` に更新する。

## Idempotency

- `traveling -> delivered` の条件付き更新
- 既に delivered の Letter を再配送しない
- 同時実行でも一件だけ成功する設計
- 通知には idempotency key を検討

## State vs Notification

手紙の到着と通知成功を同一扱いにしない。Push が失敗しても、アプリを開けば届いた手紙が存在する状態を守る。

## Notification

> Re:Me  
> あなた宛ての手紙が届いています。

本文プレビューはしない。

## Timezone

`scheduled_at` は UTC。UI は local timezone。「○日前のあなたから」は `sent_at` から計算する。
