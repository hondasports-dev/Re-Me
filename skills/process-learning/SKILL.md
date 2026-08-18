---
name: process-learning
description: Aftercare 後、Learning Event がある task または R3/R4 task を振り返り、再利用可能な process 改善へ変換する。
---

# Process Learning

R0-R2 で Event がなければ fast path:

```text
Events: none
Candidates: none
```

Full analysis trigger:

- R3 / R4
- human correction
- Gate / CI / E2E failure
- actionable review finding
- retry / incident
- scope / impact miss
- delivery / aftercare / transition miss

分析:

```text
Observed problem:
Immediate cause:
Process cause:
Why existing enforcement did not catch it:
Earlier detection / prevention condition:
```

Issue 固有名を外して generalize し、改善 target は次の優先度で選ぶ。

1. Script / Code
2. CI / Gate
3. Skill
4. AGENTS.md の短い Policy
5. Runbook / Docs

scope 外の process 改善を現在 PR へ勝手に混ぜない。
