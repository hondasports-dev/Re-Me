# データモデル

実装上の正本は `supabase/migrations/`。この文書は設計意図を説明する。

## Model

```mermaid
erDiagram
    AUTH_USER ||--|| USER_SETTINGS : has
    AUTH_USER ||--o{ THREAD : owns
    THREAD ||--o{ LETTER : contains
    LETTER ||--|| LETTER_CONTENT : has
    LETTER ||--o{ LETTER_ATTACHMENT : has
    LETTER o|--o| LETTER : replies_to
    AUTH_USER ||--o{ PUSH_SUBSCRIPTION : owns

    LETTER ||--|| PRIVATE_DELIVERY : scheduled_by
    LETTER ||--o| NOTIFICATION_JOB : creates
```

## なぜ `letters` と `letter_contents` を分けるか

Re:Me では「未来を旅していること」は見せたいが、「封をした本文」は到着・開封まで本人にも見せたくない。

1 table に metadata と body を置くと、RLS は row 単位なので metadata だけ取得しながら body だけ隠す設計が不自然になる。

そのため:

- `letters`: 一覧・状態表示に必要な metadata
- `letter_contents`: 本文

に分離する。

`letter_contents` の RLS は以下の場合だけ SELECT を許可する。

- draft
- 封をしていない
- `open_letter` 済み

これにより sealed + traveling / sealed + delivered + unopened の本文は authenticated client から取得できない。

## Public entities

### user_settings

- `user_id`
- `timezone`
- `push_enabled`
- `email_notification_enabled`

### threads

一連の時間差会話の単位。

- `id`
- `user_id`
- `created_at`
- `updated_at`
- `deleted_at`

### letters

本文を除く手紙 metadata。

- `id`
- `thread_id`
- `user_id`
- `parent_letter_id`
- `status`: `draft | traveling | delivered`
- `sealed`
- `delivery_mode`
- `delivery_window_start`
- `delivery_window_end`
- `sent_at`
- `delivered_at`
- `opened_at`
- `replied_at`
- `created_at`
- `updated_at`
- `deleted_at`

`opened / replied` は独立 status にせず timestamp として保持する。配送状態とユーザー操作状態を混ぜないため。

### letter_contents

- `letter_id`
- `user_id`
- `body`

送信後は DB trigger でも UPDATE / DELETE を拒否する。

### letter_attachments

- `photo`
  - R2 object key
  - MIME / byte size / width / height
- `location`
  - display 用 location label

位置情報は記憶補助が目的なので、MVP では正確な緯度経度を恒久保存することを前提にしない。

### push_subscriptions

Web Push endpoint と key をユーザー単位で保持する。

## Private entities

### private.letter_delivery

- `letter_id`
- `scheduled_at`

正確な到着日時は public schema に置かない。

ユーザーが知るのは「数か月後くらい」という window までで、実際の `scheduled_at` は Worker / service role だけが扱う。

### private.notification_jobs

Delivery と Notification を分離する outbox。

- `letter_id`
- `user_id`
- `status`
- `attempt_count`
- `available_at`
- `locked_at`
- `sent_at`
- `last_error`

Push 失敗で手紙自体が未到着へ戻らないようにする。

## State

```text
draft
  │ send_letter
  ▼
traveling
  │ scheduled_at 到達
  ▼
delivered
```

別軸:

```text
delivered
  │ open_letter
  ▼
opened_at != null
  │ reply を未来へ送信
  ▼
replied_at != null
```

## Thread invariant

返信は同じ `thread_id` に所属し、`parent_letter_id` で直前の手紙を指す。

MVP は partial unique index により、一つの非削除 Letter に対する次の Letter を最大 1 通に制限する。

```text
Me(2026) -> Me(2027) -> Me(2028)
```

枝分かれさせない。

## Immutable boundary

送信後に変更できないもの:

- 本文
- 添付
- thread / parent
- sealed
- delivery mode / window
- sent_at

変更できる lifecycle metadata:

- `status`
- `delivered_at`
- `opened_at`
- `replied_at`
- `deleted_at`

この境界は UI だけでなく DB trigger / RPC で強制する。

## Trusted RPC

Browser から自由な table UPDATE を許可せず、重要な状態遷移は RPC に寄せる。

- `create_draft`
- `send_letter`
- `open_letter`
- `delete_letter`
- `deliver_due_letters`（service role only）
- `claim_notification_jobs`（service role only）
- `complete_notification_job`（service role only）
