# Initial implementation issue plan

```text
Architecture decision
  ↓
Auth0 + Convex foundation
  ↓
Convex schema + authorization
  ↓
Auth0 Google OAuth connection + Convex auth
  ↓
Legacy Supabase boundary removal
  ↓
Compose / Draft
  ├─ Photo / private R2
  └─ Send / Seal
       ↓
Convex delivery / notification
  ↓
Inbox / Open
  ↓
Reply / Thread
  ↓
PWA / Push
  ↓
Migration cleanup / CI hardening
```

Auth0 tenant、Convex deployment、Cloudflare environment の provisioning と production write を同じ Issue に混ぜない。Production data migration は inventory、dry-run、rollback、Human Gate を独立 acceptance criteria にする。

各 Issue は最新の [ADR-0009](../architecture/decisions/0009-auth0-convex-cloudflare.md) を source of truth とし、旧 Supabase Issue / PR の記述だけで target architecture を上書きしない。
