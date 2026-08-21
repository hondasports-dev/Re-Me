---
name: delivery
description: Verified / reviewed content を publish し、Finding Ledger と required controls を確認して PR Aftercare へ渡す。
---

# Delivery

前提:

- Spec Confidence = C1 / C2
- Acceptance Criteria の required Verification PASS
- profile / control が要求した REVIEW 完了
- Finding Ledger に blocking entry なし
- required Human Gate がある場合は approval 記録済み
- scope integrity PASS

`risk_reconciliation PASS` や工程ごとの重複 head evidence は前提にせえへん。Finding の最終状態は同じ Ledger record を見る。

## Publish check

- intended diff のみ
- untracked / secret / local-only artifact なし
- `revision.verified` が current content に対して有効
- required REVIEW がある場合 `revision.reviewed` が current content に対して有効
- current task の Delivery PR は原則1つ

Default Delivery target は `merge_ready`。
`pr_created` は checkpoint であって terminal ではない。

PR には最低限:

- 変更内容 / 理由
- Risk / Required Controls
- Verification
- required Review
- unresolved ではない residual decision がある場合だけ Finding disposition / follow-up
- related Issue / task source

Publish 後に `revision.published` を記録して PR Aftercare へ進む。

## Content changed after publish

PR head が変わったら SHA の違いだけで全 evidence を破棄せえへん。

- same tree/content → previous evidence reuse
- content changed → delta Verification / delta REVIEW
- protected behavior / AC coverage / Risk / Controls が変化 → 必要な affected scope を再実行

Delivery は Finding Ledger に `open` / `fix_now`、未承認 acceptance、evidence 不足 defer / not-applicable があれば BLOCKED。
