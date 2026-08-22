---
name: implementation
description: PREPARE で固定した AC / Scope / Risk / Controls に従い、1 writer を基本として最小差分を実装する。
---

# Implementation

前提:

- Spec Confidence = C1 / C2
- Goal / Scope / Acceptance Criteria が固定済み
- Risk / Required Controls / Verification plan が記録済み
- production / irreversible write が必要なら Human Gate 条件を確認済み

開始前に必要なのは PREPARE packet の再読込だけや。Requirements や Impact を別形式で再要約せえへん。

## Writer boundary

- 同一 shared diff の writer は原則1体
- 複数 writer は path と責務を明確に分離できる場合だけ
- writer 同士の設計議論を default にしない
- 他 task の変更を混ぜない
- secret / local artifact を commit しない

振る舞い変更・bug fix では適切なら RED → GREEN を使う。

実装中に material ambiguity、shared caller、auth/authorization/schema/external write、rollback difficulty など新しい影響を発見したら、scope を勝手に広げず PREPARE の Risk / Controls / AC を更新する。

終了時に tracked / untracked を含めて scope integrity を確認し、変更した content を Verification へ渡す。
