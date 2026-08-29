# 手紙の配送・通知

## 配送モデル

送信時に以下を一度だけ決定する。

```text
配送モード
  → 配送レンジ
  → 正確な scheduledAt
  → traveling
```

ユーザーへ返すのは配送レンジまで。正確な `scheduledAt` は `letterDeliveries` に置き、public function の返り値から除外する。

## 初期レンジ

| UI | `deliveryMode` | 初期レンジ |
|---|---|---|
| 数日後くらい | `few_days` | 3〜7日 |
| 数週間後くらい | `few_weeks` | 14〜30日 |
| 数か月後くらい | `few_months` | 60〜180日 |
| 1年後くらい | `about_year` | 300〜430日 |
| 未来に任せる | `surprise` | 30〜365日 |

## 送信 transaction

`sendLetter` mutation は同一 transaction で以下を行う。

1. 現在ユーザーと下書きの所有権を検証する
2. 本文 / 添付状態を検証する
3. 配送レンジと正確な `scheduledAt` を決定する
4. 手紙を `traveling` にする
5. `letterDeliveries` を作成する
6. 返信の場合は親手紙を transaction 内で確保する

Client は正確な時刻、所有者、traveling 状態を指定できない。

## スケジュール方針

正本は `letterDeliveries.scheduledAt` である。Convex cron（1分間隔）が due index を件数上限つきバッチで読み、internal mutation で配送する。

個別の `scheduler.runAt` は近距離の起こし最適化として将来使えるが、MVP の正本にはしない。cancel / 再スケジュール / 移行 / 復旧を database 状態から行えるようにする。

```text
Convex cron
  → 期限到来した配送 document（index、件数上限）
  → deliverDueLetters internal mutation
  → 手紙の到着 + 通知 outbox
```

## 冪等性

- `traveling` かつ期限到来した手紙だけを配送する
- 配送 mutation が現在状態を再検証する
- 手紙ごとの通知 job を一つに固定する
- 同じ cron / scheduled callback が重なっても delivered 状態と outbox を二重生成しない
- バッチを超えた分は次回実行へ残す

Convex mutation は transactional だが、外部 Push action は transaction ではない。両者を分離する。

## 通知 outbox

```text
手紙が到着
  → 通知 pending
  → generation を claim
  → Web Push action
  → sent / failed
```

`claimNotificationJobs` は pending / 再試行可能な failed job を claim し、generation token を発行する。`completeNotificationJob` は現在の generation と processing 状態が一致する場合だけ結果を書き込む。

Action は at-most-once の失敗を前提とし、一時エラーは mutation が backoff と次回 retry を明示的に予約する。古い action の結果で新しい claim を上書きしない。

## Push のプライバシー

通知には本文、写真、場所、ユーザー入力を含めない。

> Re:Me — あなた宛ての手紙が届いています。

通知タップ後に、認証済みアプリが metadata / 読める本文を取得する。

## タイムゾーン

Convex の timestamp は UTC の epoch milliseconds。UI は `userSettings.timezone` またはブラウザのタイムゾーンへ変換する。送信後にタイムゾーンが変わっても、確定済み `scheduledAt` は変更しない。

## 失敗 / 復旧

- cron 失敗: due 行は traveling のまま残り、次回 sweep が再処理する
- 配送 mutation 成功 / push 失敗: 手紙は delivered、job は failed / retry
- Push が 404 / 410 を返した endpoint は `disabledAt` を立て、以降の claim 対象から外す
- R2 / 添付失敗: 手紙送信前に添付の準備完了を検証する
- 古くなった processing job: lock timeout 後に新しい generation で reclaim する
- 基盤障害: 最古の due / pending 経過時間を監視し、復旧 sweep を実行する

## 監視

- due の traveling 件数 / 最古 due の経過時間
- delivered 件数 / cron 実行
- cron の skip / 失敗
- 通知の pending / failed / retry 件数
- 最古 pending 通知の経過時間
- R2 認可 / upload / 削除の失敗

## 必須テスト

- 重なった cron で二重配送しない
- 期限前の手紙は配送しない
- 削除済み手紙は配送しない
- 配送と outbox 作成が atomic
- push 失敗で delivered 状態を戻さない
- 古い generation の完了を拒否する
- 正確な配送時刻が client の結果に出ない
- バッチ上限を超えた残件を次回処理できる
