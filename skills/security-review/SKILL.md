---
name: security-review
description: security_review control が発火した REVIEW stage でだけ読む specialist rubric。独立した常設直列 Gate ではない。
---

# Security Review specialist

この Skill は次のような security control が必要な場合だけ使う。

- authentication / authorization
- Worker authorization / legacy Convex migration / cross-user data boundary
- secret / privileged env
- user-controlled HTML / URL / redirect / file / MIME
- external write boundary
- destructive or production security behavior

通常の REVIEW reviewer が十分に扱える場合は別エージェントを増やさへん。**materially distinctなsecurity Controlを独立に確認する価値がある場合だけ** specialist reviewer を追加する。

R4分類だけを理由にspecialistを増やさない。specialist追加がwall-clock短縮または独立coverage改善にmaterialに効かない場合はroot reviewer内で扱う。

## Authentication / Authorization

- Auth0 issuer / audience / JWT validationとWorker auth readiness
- request body の user_id 等を信頼していないか
- ownership / privileged route / D1 query の server-side enforcement
- cross-user access
- legacy Convex → D1 migrationではsource identity mapping / rollback境界

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

- Auth0 Management credential / Cloudflare secret / legacy Convex deploy key / R2 secret / VAPID private key / OAuth secret が browser / log / commit に出ないか
- local / preview / production env 混同がないか

## External / Destructive

- R2 / Worker / D1 / Auth0 / OAuth / Push / legacy Convex migration write boundary
- retry / idempotency
- rollback / recovery
- production / irreversible operation の Human Gate

## Output

Finding は current task instance の `findings` に直接追加する。同じ finding を security-specific residual 配列や reconciliation record へコピーせえへん。

protected domain の finding は agent 単独 defer 不可。`test_gap` は Human Gate で受容せず fix または Requirements / AC 再評価へ戻す。

Specialist は他 reviewer と討論せず独立して所見を出す。root が同じ Finding Ledger 上で1回だけ統合する。
