---
name: pr-aftercare
description: PR 公開後、最新 head の CI、review、requested changes、conflict、approval を追跡し merge-ready まで収束させる。
---

# PR Aftercare

PR 作成で止まらず、latest head が merge-ready になるまで current task を保持する。

Cycle ごとに固定する。

```text
PR:
Base:
Head branch:
Observed head SHA:
Risk / profile:
Delivery target:
```

`task-state.current_head_sha` と latest PR head を毎 cycle 照合する。current / verified / reviewed / reconciled / published / observed は該当 cycle で full git object id と構造化 head evidence（source、ref_or_command、result、head_sha、observed_at）を持つこと。Local は `git rev-parse HEAD`、remote PR は GitHub `headRefOid` を使い、empty 同士の一致は認めへん。head が変わったら old head の success を流用せず、Verification の `verified_head_sha`、Code / Security Review の `reviewed_head_sha`、Risk Reconciliation の `reconciled_head_sha`、Delivery / Aftercare evidence を全て無効化する。変更を含めて Verification → Reviews → Risk Reconciliation → Delivery → Aftercare を再実行する。

監視対象:

- required CI / checks
- actionable human / bot review findings
- requested changes
- unresolved blocking threads
- required approval
- conflict / mergeability

pending / queued / in_progress は PASS ではない。

Finding / CI failure で code change が必要なら、同じ PR で Implementation → profile-required Verification / Review → Delivery → Aftercare を再実行する。

Merge-ready 条件:

- latest head の required checks success
- actionable blocking finding なし
- requested changes なし
- required approval satisfied
- conflict なし
- mergeable
- current / verified / reviewed / reconciled / published / observed head が latest PR head で、各 evidence の observed_at が記録済み

ユーザーが明示的に「PR作成までで止める」と言った場合のみ NOT_REQUIRED 可。
