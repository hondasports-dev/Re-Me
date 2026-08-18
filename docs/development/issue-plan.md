# Initial implementation issue plan

実装開始時の順序を GitHub Issues と同期するための補助資料。

基本順序:

```text
Foundation
  ↓
Supabase schema / RLS
  ↓
Auth
  ↓
AppShell / Design System
  ↓
Compose / Draft
  ├─ Photo / R2
  └─ Send / Seal
       ↓
Traveling letters
       ↓
Delivery Worker / Notification
       ↓
Inbox / Open
       ↓
Reply / Thread
       ↓
PWA / Push polish
       ↓
CI / Critical E2E hardening
```

各 Issue は DB / UI / Worker の境界を跨ぎすぎないように分割する。ただし Re:Me の critical flow は最終的に E2E で繋いで検証する。

Issue 本文の acceptance criteria を実装完了条件とし、仕様変更が発生した場合は Issue だけでなく関連 docs / ADR / migration を更新する。
