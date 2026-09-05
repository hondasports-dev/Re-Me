# 手紙の配送・通知

## 配送モデル

送信時に以下を一度だけ決定し、exact な時刻は内部 D1 row にだけ保存する。

```text
配送 mode
配送 window start / end
内部 scheduled_at
```

browser API が返すのは mode と window で、`scheduled_at` は返さない。

## Worker の起動

`worker/index.ts` の `scheduled()` が5分ごとに次を実行する。

1. D1 の `letter_deliveries_due_idx` から due row を上限付きで claim する
2. traveling letter を delivered へ遷移し、同じ transaction で notification outbox を作る
3. claim した notification job を `NOTIFICATION_QUEUE` へ enqueue する
4. enqueue 失敗は job を failed に戻し、次回 retry 可能にする
5. R2 attachment の deleting / expired staging state を reconcile する

scheduled handler は browser の認証文脈に依存せず、D1 の状態条件を毎回再確認する。

## 通知の非同期処理

Queue consumer は `jobId` と generation token を受け取り、次を行う。

1. generation、status、lock timeout を確認して send target を claim する
2. owner の有効な push subscription へ本文なしの arrival payload を送る
3. 404 / 410 endpoint は無効化する
4. 成功なら `sent`、一時失敗なら error code と backoff 時刻を記録する
5. subscription が無い場合も到着状態を変更せず job だけを完了する

通知 job は手紙の delivery state の代わりではない。push provider や Queue が停止
しても、到着済みの手紙を traveling に戻さない。

## 冪等性と競合

- delivery row は letter ごとに一意で、claim は `status` と `scheduled_at` の条件付き
  update で行う
- notification job は letter ごとに一意で、generation token と lock timeout で
  stale runner を無効化する
- Queue の再配信や scheduled の重複実行があっても二重到着・二重 job を作らない
- retry は指数 backoff と上限付き attempt count で行う
- attachment finalize / delete も generation token と durable reconcile state で
  single-flight にする

## 観測

log には event 名、件数、endpoint host、error class だけを出す。本文、写真、R2
object key、owner の外部 identifier、exact `scheduled_at`、secret は出さない。

運用時は D1 で次を確認する。

- due の pending delivery 数と最古の scheduled time
- notification job の pending / processing / failed 数
- lock timeout 後に再 claim されていること
- delivered letter が traveling に戻っていないこと
- deleting attachment が reconcile で減っていること

## 検証

- `tests/worker/` で migration、ownership、state transition、delivery、notification、
  attachment の integration を検証する
- `tests/unit/notification-policy.test.ts` で payload privacy、retry、endpoint
  invalidation policy を検証する
- Preview では `/api/health`、authenticated API、force delivery、Queue / push の
  smoke を確認する
