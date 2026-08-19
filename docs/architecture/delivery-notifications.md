# 手紙の配送・通知

## Delivery model

送信時に以下を一度だけ決定する。

```text
delivery mode
  ↓
delivery window
  ↓
exact scheduled_at
  ↓
traveling
```

ユーザーへ見せるのは delivery window まで。

exact `scheduled_at` は `private.letter_delivery` に保存し、authenticated client から直接取得できない。

## Initial ranges

| UI | `delivery_mode` | 初期 range |
|---|---|---|
| 数日後くらい | `few_days` | 3〜7日 |
| 数週間後くらい | `few_weeks` | 14〜30日 |
| 数か月後くらい | `few_months` | 60〜180日 |
| 1年後くらい | `about_year` | 300〜430日 |
| 未来に任せる | `surprise` | 30〜365日 |

`surprise` の 30〜365日は MVP 初期値であり、検証対象とする。

「判断したい内容が遅すぎて意味を失う」問題は `few_days` / `few_weeks` で避け、「振り返り」は `surprise` でサプライズ性を残す。

## Send

`send_letter` RPC が以下を atomic に行う。

1. authenticated user と draft ownership を検証
2. body が空でないことを検証
3. delivery window を決定
4. window 内から exact `scheduled_at` を一回だけ決定
5. public letter を `traveling` にする
6. private delivery row を作る
7. reply の場合は parent `replied_at` を設定

Client から `scheduled_at` を渡さない。

## Cron

Cloudflare Cron Trigger から Worker の `scheduled` handler を起動する。

Worker は Service Role で `deliver_due_letters` RPC を呼ぶ。

RPC 内部では概念的に以下を行う。

```text
private.letter_delivery.scheduled_at <= now
+ public.letters.status = traveling
+ deleted_at is null

        ↓ FOR UPDATE SKIP LOCKED

public.letters.status = delivered
public.letters.delivered_at = now

        ↓ same transaction

private.notification_jobs INSERT
```

## Idempotency

`deliver_due_letters` は:

- `traveling` のみを対象にする
- row lock + `SKIP LOCKED` を使う
- notification job に `unique(letter_id)` を持つ

同じ cron が重なっても二重配送・二重 outbox を作らない設計にする。

## State vs Notification

到着と通知送信は分離する。

```text
Letter delivered
      ↓
Notification outbox pending
      ↓
Worker claim
      ↓
Push success / retry
```

Push が失敗しても Letter は `delivered` のまま。

ユーザーがアプリを開けば手紙は必ず受信箱に存在する。

## Notification outbox

`claim_notification_jobs` が pending / failed job を lock し `processing` にする。claim ごとに推測困難な `claim_token` を発行し、Worker は job id と一緒に保持する。

処理中 Worker が落ちた場合、一定時間経過した `processing` job を reclaim できる。

`complete_notification_job(job_id, claim_token, success, error)`:

- success → `sent`
- failure → `failed` + backoff 用 `available_at`
- success / failure とも `claim_token` と lock を clear する
- reclaim 後の古い token、または完了済み job の再完了は拒否し、job state を変更しない

## Push

通知内容は最小限にする。

> **Re:Me**  
> あなた宛ての手紙が届いています。

以下は表示しない。

- 本文
- 写真
- 場所
- 過去のユーザー入力

通知 tap 後にアプリで「184日前のあなたから」などの metadata を表示する。

## Delivery Worker pseudo flow

```text
scheduled()
  ├─ rpc(deliver_due_letters)
  ├─ rpc(claim_notification_jobs)
  └─ each job
       ├─ load user push subscriptions
       ├─ send Web Push
       └─ rpc(complete_notification_job(job_id, claim_token, success, error))
```

1 cron で処理しきれない件数は batch limit を設け、次回実行へ回す。

## Timezone

DB timestamps は UTC。

- exact delivery calculation: UTC absolute time
- UI: `user_settings.timezone` / browser timezone へ変換
- 「184日前」: `sent_at -> current time` の elapsed duration から計算

送信後にユーザーが timezone を変更しても、確定済み exact delivery time は移動させない。

## Monitoring

最低限追跡する。

- due letter count
- delivered count / cron run
- notification pending / failed count
- notification retry count
- oldest pending notification age

「届くはずの手紙が届かない」は Re:Me の体験を直接壊すため、通常の background job より強く監視する。
