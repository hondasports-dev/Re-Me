---
name: security-review
description: R3/R4 または quick scan で昇格した変更に対し、auth、RLS/data boundary、input、secret、external service、destructive operation を独立確認する。
---

# Security Review

Required:

- R3 high
- R4 critical
- R1/R2 quick scan で R3 floor trigger を発見

観点:

### Authentication / Authorization

- Supabase session / JWT validation
- Worker が request body の user_id を信用していないか
- ownership / RLS / RPC server-side enforcement
- cross-user access

### Data / Privacy

- sealed content visibility
- exact `scheduled_at` exposure
- photo / location / EXIF leakage
- delete / retention
- migration compatibility

### Input

- text / URL / redirect / filename / MIME validation
- HTML / XSS
- error message による情報露出

### Secrets

- Service Role / VAPID private key / OAuth secret が browser / log / commit に出ないか
- local / production env 混同がないか

### External / Destructive

- R2 / Worker / OAuth / Push の write boundary
- retry / idempotency
- rollback / recovery
- R4 Human Gate

Must-fix があれば Implementation → Verification → Code Review → Security Review をやり直す。
