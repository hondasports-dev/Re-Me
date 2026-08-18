---
name: delivery
description: profile-required Verification / Review が PASS した head を commit / push し、current task の PR を作成または更新する。PR 作成は completion ではない。
---

# Delivery

前提:

- Spec Confidence C1/C2
- Risk / profile 記録済み
- profile-required Verification / Review PASS
- scope integrity PASS

Default Delivery target: `merge_ready`。
`pr_created` は checkpoint であり terminal ではない。

Publish 前に確認する。

- intended diff のみ
- untracked / secret / local-only artifact なし
- verified head と published head が一致
- current task の Delivery PR は最大1つ

PR には最低限:

- 変更内容 / 理由
- Spec Confidence / Risk / Profile
- Verification Evidence
- required Review Evidence
- residual risk / follow-up
- related Issue / task source

PR 公開後は `PR_AFTERCARE` へ進む。
