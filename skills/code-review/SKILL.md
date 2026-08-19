---
name: code-review
description: Verification 後、差分の正しさ・回帰・保守性・テスト妥当性を review し、R1/R2 では Security quick scan も行う。
---

# Code Review

共通観点:

- Goal / AC / scope との一致
- null / empty / boundary / error
- async / race / stale state
- API / type / DB contract
- caller compatibility
- unnecessary abstraction / dependency
- changed tests が仕様を assert しているか
- mobile loading / empty / error / a11y / navigation

## Security quick scan for R1/R2

- auth / authorization / RLS 条件を変更していないか
- user data boundary に影響しないか
- user-controlled HTML / URL / redirect / file を扱わないか
- secret / privileged env に触れないか
- external service write を増やさないか
- destructive / production behavior を変えないか

R3 floor trigger を見つけたら quick scan だけで PASS せず Risk を昇格し、Security Review を要求する。

Review は対象 head SHA を固定し、実装時の自己確認をそのまま Evidence として流用しない。

## Finding handoff

Finding があれば、`PASS` や `nice_to_have` / `non-must-fix` のラベルだけで消さず、`risk_reconciliation` へ構造化して渡す。各 finding に少なくとも次を記録する。

```text
id / finding / failure_scenario / affected_invariants /
affected_acceptance_criteria / risk_domains / test_gap / test_gap_id /
source / evidence / recommended_disposition
```

`recommended_disposition` は reviewer の推薦に留め、最終 `disposition`（fix / defer / human gate / not applicable）は root の Risk Reconciliation が決める。`findings` の id は stable / unique にし、全て一件以上の reconciliation record の `source_finding_ids` へ移送する。summary の `must_fix` / `nice_to_have` だけで移送済みとみなさへん。non-empty `test_gap` には必ず `test_gap_id` を付ける。current scope、auth、RLS、data integrity、state rollback、idempotency、atomicity、immutability、privileged boundary、test gap に触れる所見は、non-must-fix として省略せず明示する。
Reconciliation への移送では、source の `test_gap` / `test_gap_id` を完全一致で保持し、protected `risk_domains` を全て含め、failure scenario / affected invariants / affected acceptance criteria を欠落・弱化させへん。source より広げる場合は `source_fidelity` の explicit-superset evidence を添える。source に gap があれば、同じ id / text を Verification の `material_test_gaps` にも記録する。
