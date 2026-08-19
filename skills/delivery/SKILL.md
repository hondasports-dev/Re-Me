---
name: delivery
description: profile-required Verification / Review が PASS した head を commit / push し、current task の PR を作成または更新する。PR 作成は completion ではない。
---

# Delivery

前提:

- Spec Confidence C1/C2
- Risk / profile 記録済み
- profile-required Verification / Review PASS
- `risk_reconciliation` PASS（current head と `reconciled_head_sha` が一致）
- R3/R4、finding、residual risk、material test gap の trigger がある場合は `risk_reconciliation.required: true` が記録済み
- `current_head_sha`、`verification.verified_head_sha`、各 Review の `reviewed_head_sha`、`reconciled_head_sha` が full git object id、対応する head evidence 付きで一致
- residual risk の `pending` / `fix_now` がゼロ
- `test_gap` がゼロ（test gap は Human Gate / accept で迂回不可）
- `defer_with_evidence` は unreachable または safe failure / invariant・AC非破壊 / mitigation / follow-up issue / current-head evidence が構造化されて揃っている
- `defer_with_evidence` は非保護 risk domain に限る。source finding の `test_gap` / `test_gap_id`、protected domain、failure scenario / invariant / AC の source fidelity を欠落・弱化させた residual は publish 前に BLOCK
- `accept_with_human_gate` は test gap なしで、approver / approved_at / scope / approval evidence が記録済み
- `not_applicable` は成立しない rationale / not_applicable_proof / evidence / current-head binding が記録済み
- scope integrity PASS

Default Delivery target: `merge_ready`。
`pr_created` は checkpoint であり terminal ではない。

Publish 前に確認する。

- intended diff のみ
- untracked / secret / local-only artifact なし
- current / verified / reviewed / reconciled / published head が full git object id、各 head evidence 付きで一致。published は push 後に `GitHub PR headRefOid`（local-only checkpoint なら `git rev-parse HEAD`）で観測する
- current task の Delivery PR は最大1つ

Pending / unresolved residual risk、`test_gap`、required reconciliation の false / 未記録、head/evidence 不一致が一つでもあれば Delivery は BLOCKED。reviewer の `PASS`、`nice_to_have`、`non-must-fix` ラベルだけを理由に finding を除外せえへん。

PR には最低限:

- 変更内容 / 理由
- Spec Confidence / Risk / Profile
- Verification Evidence
- required Review Evidence
- Risk Reconciliation の disposition / rationale / evidence / follow-up
- residual risk / follow-up
- related Issue / task source

PR 公開後は `PR_AFTERCARE` へ進む。Aftercare で latest PR head が変わったら current / verified / reviewed / reconciled / published head の一致を失ったものとして、Verification → Reviews → Risk Reconciliation → Delivery evidence を再実行する。
