# 手紙の配送・通知

## Delivery model

送信時に以下を一度だけ決定する。

```text
delivery mode
  → delivery window
  → exact scheduledAt
  → traveling
```

ユーザーへ返すのは delivery window まで。exact `scheduledAt` は `letterDeliveries` に置き、public function の return shape から除外する。

## Initial ranges

| UI | `deliveryMode` | 初期 range |
|---|---|---|
| 数日後くらい | `few_days` | 3〜7日 |
| 数週間後くらい | `few_weeks` | 14〜30日 |
| 数か月後くらい | `few_months` | 60〜180日 |
| 1年後くらい | `about_year` | 300〜430日 |
| 未来に任せる | `surprise` | 30〜365日 |

## Send transaction

`sendLetter` mutation は同一 transaction で以下を行う。

1. current user と draft ownership を検証
2. body / attachment state を検証
3. delivery window と exact `scheduledAt` を決定
4. letter を `traveling` に変更
5. `letterDeliveries` を作成
6. reply の場合は parent を transactionally claim する

Client は exact time、owner、traveling state を指定できない。

## Scheduling strategy

正本は `letterDeliveries.scheduledAt` である。Convex cron（1分間隔）が due index を bounded batch で読み、internal mutation で配送する。

個別 `scheduler.runAt` は近距離の wake-up 最適化として将来利用できるが、MVP の正本にはしない。cancel / reschedule / migration / reconciliation を database state から行えるようにする。

```text
Convex cron
  → due delivery documents (indexed, bounded)
  → deliverDueLetters internal mutation
  → letter delivered + notification outbox
```

## Idempotency

- `traveling` かつ due の letter だけを配送
- delivery mutation が current state を再検証
- letter ごとの notification job を一つに固定
- 同じ cron / scheduled callback が重なっても delivered state と outbox を二重生成しない
- batch を超えた分は次回 run へ残す

Convex mutation は transactional だが、external Push action は transaction ではない。両者を分離する。

## Notification outbox

```text
Letter delivered
  → notification pending
  → claim generation
  → Web Push action
  → sent / failed
```

`claimNotificationJobs` は pending / retryable failed job を claim し、generation token を発行する。`completeNotificationJob` は現在の generation と processing state が一致する場合だけ結果を書き込む。

Action は at-most-once failure を前提とし、transient error は mutation が backoff と次回 retry を明示的に schedule する。古い action result で新しい claim を上書きしない。

## Push privacy

通知には本文、写真、場所、ユーザー入力を含めない。

> Re:Me — あなた宛ての手紙が届いています。

notification tap 後に authenticated app が metadata / readable content を取得する。

## Timezone

Convex timestamp は UTC epoch milliseconds。UI は `userSettings.timezone` または browser timezone へ変換する。送信後に timezone が変わっても確定済み `scheduledAt` は変更しない。

## Failure / recovery

- cron failure: due rows は traveling のまま残り、次回 sweep が再処理
- delivery mutation success / push failure: letter は delivered、job は failed / retry
- R2 / attachment failure: letter send 前に attachment readiness を検証
- stale processing job: lock timeout 後に新しい generation で reclaim
- vendor outage: oldest due / pending age を監視し、recovery sweep を実行

## Monitoring

- due traveling count / oldest due age
- delivered count / cron run
- cron skipped / failed runs
- notification pending / failed / retry count
- oldest pending notification age
- R2 authorization / upload / delete failure

## Required tests

- overlapping cron で二重配送しない
- due でない letter は配送しない
- deleted letter は配送しない
- delivery と outbox 作成が atomic
- push failure で delivered state を戻さない
- stale generation completion を拒否
- exact schedule が client result に出ない
- batch limit を超えた残件を次回処理できる
