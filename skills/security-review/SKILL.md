---
name: security-review
description: security_review control が発火した REVIEW stage でだけ読む specialist rubric。独立した常設直列 Gate ではない。
---

# Security Review specialist

この Skill は次のような security control が必要な場合だけ使う。

- authentication / authorization
- Convex authorization / legacy RLS / cross-user data boundary
- secret / privileged env
- user-controlled HTML / URL / redirect / file / MIME
- external write boundary
- destructive or production security behavior

通常の REVIEW reviewer が十分に扱える場合は別エージェントを増やさへん。専門性が明確に異なる、または R4 で追加独立性が必要な場合だけ specialist reviewer を並列追加する。

## Authentication / Authorization

- Auth0 issuer / audience / JWT validationと Convex auth readiness
- request body の user_id 等を信頼していないか
- ownership / public-internal function / legacy RLS-RPC の server-side enforcement
- cross-user access

## Data / Privacy

- sealed content visibility
- exact `scheduled_at` exposure
- photo / location / EXIF leakage
- delete / retention
- migration compatibility

## Input

- text / URL / redirect / filename / MIME validation
- HTML / XSS
- error message による情報露出

## Secrets

- Auth0 Management credential / Convex deploy key / R2 secret / VAPID private key / OAuth secret が browser / log / commit に出ないか
- local / production env 混同がないか

## External / Destructive

- R2 / Convex / Worker / Auth0 / OAuth / Push write boundary
- retry / idempotency
- rollback / recovery
- production / irreversible operation の Human Gate

## Output

Finding は `task-state.findings` に直接追加する。同じ finding を security-specific residual 配列や reconciliation record へコピーせえへん。

protected domain の finding は agent 単独 defer 不可。`test_gap` は Human Gate で受容せず fix または Requirements / AC 再評価へ戻す。

Specialist は他 reviewer と討論せず独立して所見を出す。root が同じ Finding Ledger 上で1回だけ統合する。
