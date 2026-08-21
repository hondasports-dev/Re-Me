---
name: code-review
description: REVIEW stage。Risk Profile / Required Controls に応じて独立 review を最大1回行い、finding は単一 Ledger に記録する。
---

# REVIEW

REVIEW は default で複数エージェントを議論させへん。

- R0: 原則 NOT_REQUIRED
- R1: control が要求した時だけ
- R2/R3/R4: independent reviewer ×1
- R4 または明確に異なる専門領域が必要な場合だけ specialist を並列追加可能

Reviewer 同士は debate せず、各 reviewer が独立に Finding Ledger へ所見を出し、root が1回だけ disposition を統合する。

## Common review rubric

- Goal / AC / scope との一致
- null / empty / boundary / error
- async / race / stale state
- API / type / DB contract
- caller compatibility
- unnecessary abstraction / dependency
- changed tests が仕様を assert しているか
- mobile loading / empty / error / a11y / navigation
- rollback / idempotency when stateful

## Security rubric

`security_review` control がある場合は同じ REVIEW stage に Security 観点を追加する。深い専門確認が必要な場合だけ `skills/security-review/SKILL.md` を読む。

最低限:

- authentication / authorization / RLS / user boundary
- user-controlled HTML / URL / redirect / file / MIME
- secret / privileged env
- external write boundary
- destructive / production behavior

## Finding Ledger

Finding があれば `task-state.findings` に直接追加する。

```text
id
source
category
finding
failure_scenario
affected_acceptance_criteria
affected_invariants
risk_domains
evidence
recommended_action
disposition
```

別の residual-risk record や source-fidelity record へ転記せえへん。

Reviewer は原則 `recommended_action` を出す。明白な must-fix は `disposition: fix_now` としてよいが、defer / human acceptance / not-applicable の最終判断は root が同じ Ledger record を更新する。

Rules:

- `open` / `fix_now` は Delivery BLOCKED
- protected domain は agent 単独 defer 不可
- `test_gap` は fix または Requirements / AC 再評価のみ
- `not_applicable` は proof 必須
- Human acceptance は approval evidence 必須

## Revision / delta review

Review は `revision.reviewed` に対象 commit/tree を記録する。

後続で head が変わった場合、tree が同じなら review evidence を再利用する。content が変わったら差分だけ review し、protected behavior / AC coverage / Risk / Controls が変わった時だけ full affected review に戻す。

実装時の自己確認を独立 review の代わりにせえへん。
