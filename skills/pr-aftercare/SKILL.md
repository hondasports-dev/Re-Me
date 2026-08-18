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

head SHA が変わったら old head の success を流用しない。

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
- verified head が current

ユーザーが明示的に「PR作成までで止める」と言った場合のみ NOT_REQUIRED 可。
