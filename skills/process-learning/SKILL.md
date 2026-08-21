---
name: process-learning
description: learning event が発生した時だけ、task 固有の失敗を再利用可能な loop 改善へ変換する。
---

# Process Learning

Risk が R3/R4 という理由だけでは Full Learning を起動せえへん。予定通り完了した高 risk task に毎回 retrospective を課すと、コストだけが増える。

## Learning event

次のような event がある場合だけ使う。

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding that should have been caught earlier
- retry / incident
- scope / impact miss
- delivery / aftercare miss
- repeated ambiguity or manual workaround

Event がなければ task-state は次だけで閉じる。

```text
learning.event: none
learning.status: not_required
```

## Analysis

必要な場合だけ短く分析する。

```text
Observed problem:
Process cause:
Why existing control missed it:
Earlier detection / prevention condition:
```

改善 target の優先度:

1. Script / Code
2. CI / deterministic check
3. Skill
4. AGENTS.md / process.yaml の短い Policy
5. Runbook / Docs

単に説明を増やすより、自動化・削除・条件付き起動を優先する。

Issue 固有名を外して generalize し、scope 外の process 改善を現在 PR へ勝手に混ぜへん。
