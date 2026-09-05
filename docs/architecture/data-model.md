# データモデル

## Source of truth

Cloudflare D1 の schema は `migrations/*.sql` を正本とする。時刻はすべて UTC の
epoch milliseconds で保存し、UI でユーザーの timezone へ変換する。既存 migration
は書き換えず、schema 変更は番号付き migration を追加する。

## エンティティ

| table | 役割 |
|---|---|
| `users` | Auth0 subject と Re:Me 内部 user の対応 |
| `user_settings` | timezone、push / email 設定 |
| `threads` | 一本道の返信スレッド |
| `letters` | 手紙 metadata、status、配送 window、ライフサイクル |
| `letter_contents` | 本文。metadata と分離 |
| `letter_attachments` | 写真 / location と R2 metadata |
| `attachment_finalization_attempts` | R2 finalize の generation / reconcile state |
| `letter_deliveries` | exact `scheduled_at` と delivery status |
| `notification_jobs` | 通知 outbox、claim、retry state |
| `push_subscriptions` | owner ごとの Web Push endpoint |

## 手紙と本文

`letters` は一覧に必要な metadata を持ち、本文は `letter_contents` に分離する。
`owner_id` を両方に持たせ、Worker が一致を検証する。

status は次の3つだけや。

```text
draft → traveling → delivered
```

送信時に body、添付、sealed、delivery mode / window、`sent_at` を固定する。D1
trigger と Worker の専用 state transition が、送信後の編集を二重に防ぐ。削除は
論理削除で、誤送信・プライバシー上の救済を優先する。

## 返信スレッド

`threads` は owner ごとの一本道を表す。`letters.parent_letter_id` と
`next_letter_id` で親子関係を持ち、active parent の unique index で同じ手紙への
返信競合を拒否する。返信作成は、親が owner の delivered letter、内容取得可能、
未返信であることを D1 transaction 内で確認する。

## 配送

`letter_deliveries` は letter ごとに一意で、`scheduled_at` は browser-facing
projection に含めない。ユーザーが見るのは `delivery_mode` と window start / end
だけや。

due index と条件付き update で scheduled sweep を claim する。同じ job が再実行
されても delivery row と letter status は一度だけ consumed / delivered へ進む。

## 通知 outbox

`notification_jobs` は delivery status と分離する。letter ごとに一意な job を作り、
`generation_token`、lock、attempt count、`available_at` で Queue retry と stale
runner を管理する。

Push が失敗しても delivered letter は traveling に戻さない。404 / 410 endpoint は
無効化し、一時失敗は指数 backoff で再試行する。

## 添付と R2

写真本体は private R2、D1 は object key と検証済み metadata だけを持つ。
`letter_attachments` は draft 中だけ候補 metadata を更新できる。finalize は
generation token、ETag、single-flight claim、R2 HEAD を再検証し、競合した候補は
reconcile state に残す。

sealed / 未開封の本文と添付は Worker が capability を発行しない。削除途中の object
は `deleting` と attempt / next reconcile を保持し、scheduled sweep で後始末する。

## Migration

`0001` が初期 D1 schema、`0002` が draft の delivery settings 修正、`0003` が
初期移行用の一時 bookkeeping table を撤去する。Preview は Cloudflare runtime へ
移行済みで、Production は未デプロイ・未投入のため、本番データ import は不要や。
将来、本番に既存データが発生した場合は別の inventory / export / dry-run / rollback /
Human Gate 付き task を起こす。
