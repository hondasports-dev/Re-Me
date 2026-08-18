---
name: task-transition
description: Aftercare と Process Learning 後、current task を閉じ、次 task へ必要な情報だけを明示的に再束縛する。
---

# Task Transition

前 task を未完了のまま次 task へ持ち込まない。

Current task closure:

```text
Task ID / source:
Objective:
Branch / worktree:
Delivery PR:
Delivery target / result:
Final head SHA:
PR Aftercare result:
Process Learning result:
```

次 task がある場合は新しい packet を作る。

```text
Next task ID / source:
Objective:
Relevant carried context:
Explicitly excluded prior context:
```

前 task の Issue / review / CI / branch / PR を暗黙に引き継がない。
Aftercare 未完了や required blocker があれば task を閉じない。
