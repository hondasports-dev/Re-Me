---
name: risk-reconciliation
description: Finding Ledger に unresolved entry がある時だけ使う disposition helper。Review/Verification の記録を別形式へ転記する Gate ではない。
---

# Finding Disposition helper

旧 Risk Reconciliation のように Review / Verification finding を residual record へコピーし、source fidelity を再検査する方式は使わへん。

`task-state.findings` が唯一の source of truth で、root は同じ record の `disposition` と resolution fields を更新する。

## When to use

次のいずれかがある時だけ使う。

- `open` finding
- reviewer recommendation の最終 disposition が必要
- defer / human acceptance / not-applicable の妥当性確認

Finding がゼロならこの helper は NOT_REQUIRED。空の Reconciliation PASS evidence を作らへん。

## Dispositions

### `fix_now`

現在の AC / invariant / control を満たせへん。Implementation に戻して修正し、変更 delta を Verification / REVIEW する。

### `defer_with_evidence`

非 protected domain のみ候補にできる。

必要:

- current AC / invariant を壊さない根拠
- mitigation
- follow-up issue
- current revision に結び付く evidence

### `accept_with_human_gate`

protected domain finding など人間の明示受容が必要な場合。

必要:

- approver
- approved_at
- scope
- approval evidence

`test_gap` には使えへん。

### `not_applicable`

Finding が成立しない proof と rationale が必要。reviewer の `nice_to_have` を機械的に置換する用途では使わへん。

### `resolved`

修正済みかつ必要な Verification / REVIEW が対象 revision で完了した状態。`resolution` と `verified_revision` を記録する。

## Protected domains

以下は agent 単独で `defer_with_evidence` にせえへん。

```text
invariant, auth, authentication, authorization, rls, data_integrity,
state_rollback, idempotency, atomicity, immutability,
privileged_boundary, current_scope, test_gap, other
```

`other` は未分類 domain として protected 扱いにし、分類できるまで agent 単独 defer に落とさへん。

`test_gap` は `fix_now` または Requirements / AC 正式変更後の再評価だけを許可する。

## Delivery decision

Delivery 前に必要なんは転記整合性ではなく Finding Ledger の状態確認や。

BLOCK:

- `open`
- `fix_now`
- approval 未完了の `accept_with_human_gate`
- evidence 不足の defer / not-applicable

PASS candidate:

- blocking finding なし
- defer / acceptance / not-applicable の evidence 完備
- resolved finding の必要な verification が current content に対して有効

Finding record を別 schema へ複製しない。source ID transfer、source_fidelity、test-gap text の多重同期も不要や。
