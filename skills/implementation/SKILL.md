---
name: implementation
description: Spec Confidence と Risk Profile が確定した後、Requirements / Impact Evidence に従って最小差分を実装する。
---

# Implementation

前提:

- Spec Confidence = C1 / C2
- Risk / profile 記録済み
- profile-required Requirements / Impact が PASS
- Workspace Preflight / always-on Safety 適用済み

開始前に固定する。

```text
Goal:
Spec confidence:
Risk / profile:
Editable scope:
Out of scope:
Acceptance Criteria:
Impact summary:
Verification plan:
```

## Writer boundary

- 同一差分の writer は原則1体
- 複数 writer は path を完全分離できる場合だけ
- 他 task の変更を混ぜない
- secret / local artifact を commit しない

振る舞い変更・bug fix では適切なら RED → GREEN を使う。

実装中に material ambiguity、shared caller、auth/RLS/schema/external write を発見したら、scope を勝手に広げず Requirements / Impact へ戻る。

終了時に tracked / untracked を含めて scope integrity を確認する。
