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

Must-fix があれば Implementation → Verification → Code Review → Security Review → Risk Reconciliation をやり直す。

## Finding handoff

Security Review の `PASS` や `non-must-fix` は最終 disposition ではない。Security Review で見つけた finding と test gap を一件ずつ `risk_reconciliation` へ渡し、次を構造化して記録する。

```text
id / finding / failure_scenario / affected_invariants /
affected_acceptance_criteria / risk_domains / test_gap / test_gap_id /
source / evidence / recommended_disposition
```

`security_review.findings` が Security Review の唯一の finding 入力経路や。曖昧な `security_review.residual_risks` summary field は使わず、生成・記録せえへん。互換入力でそれが non-empty なら、structured findings へ移送されていない summary-only risk として Reconciliation を BLOCK する。

`recommended_disposition` は独立 reviewer の推薦であり、採用・defer・Human Gate・not applicable の最終判断は root が行う。`findings` の id は stable / unique にし、全て一件以上の reconciliation record の `source_finding_ids` へ移送する。summary の `must_fix` / `nice_to_have` だけで移送済みとみなさへん。non-empty `test_gap` には必ず `test_gap_id` を付け、同じ `test_gap` と id を Verification の `material_test_gaps` にも記録する。auth、RLS、data boundary、rollback、idempotency、immutability、privileged boundary などの finding をラベルだけで residual から除外せえへん。

Reconciliation へ移すときは、source の `test_gap` / `test_gap_id` を完全一致で保持し、source にある protected `risk_domains` を全て含める。`failure_scenario`、`affected_invariants`、`affected_acceptance_criteria` は欠落・弱化させず、拡張する場合は `source_fidelity.relation: explicit_superset` と evidence を残す。移送漏れや fidelity evidence 欠落は deterministic rule で BLOCK される。
