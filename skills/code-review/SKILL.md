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
