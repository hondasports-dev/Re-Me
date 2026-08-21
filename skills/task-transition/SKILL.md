---
name: task-transition
description: task 完了後、次 task へ不要な context を持ち込まないための軽量 session cleanup helper。Completion Gate ではない。
---

# Session Cleanup helper

Task Transition は default loop の必須 Gate ではない。目的は、完了済み task の Issue / review / CI / branch context を次 task へ暗黙継承しないことだけや。

必要なら次を短く残す。

```text
Closed task:
Delivery PR / result:
Final revision:
Reusable decisions:
Explicitly discarded task-local context:
```

次 task が続く場合:

```text
Next task:
Objective:
Only relevant carried context:
```

前 task の詳細な evidence packet を再掲せえへん。

Aftercare や required blocker が未完了なら「cleanupで閉じる」のではなく current task のまま維持する。
