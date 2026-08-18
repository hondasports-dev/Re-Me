---
name: requirements
description: ユーザー要求、Issue、docs、tests、既存実装を統合し、Spec Confidence・Acceptance Criteria・Risk Profile を確定する。実装前に使う。
---

# Requirements / Specification / Risk Routing

## 1. Spec Confidence

- `C2 confirmed`: 目的・期待結果・主要 AC が明確で material conflict なし
- `C1 reconstructed`: 不足はあるが authoritative evidence から成果物をほぼ一意に復元可能
- `C0 unclear`: 複数の妥当な仕様が残る
- `C0 conflicted`: authoritative source 同士が望ましい最終状態で矛盾する

`C0` のまま Implementation へ進まない。

## 2. Source priority

1. current user instruction
2. latest approved spec / ADR / decision
3. current Issue / comments
4. canonical docs
5. tests
6. current implementation / existing pattern

Issue が「現在 B を A に変える」と明示する場合、existing B との差は expected delta であり conflict ではない。

## 3. Requirements packet

最低限:

```text
Goal:
Current behavior:
Expected behavior:
In scope:
Out of scope:
Preserve:
Acceptance Criteria:
Edge / error states:
Test strategy:
```

## 4. Risk

4軸 `0..2`:

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3

R3 floor:

- Supabase Auth / authorization / RLS
- schema / migration
- data deletion / retention
- Service Role / privileged env
- OAuth / external write
- Cloudflare privileged write
- production behavior config

R4:

- production DB migration
- bulk / irreversible data mutation
- account deletion semantics
- authorization model overhaul
- production secret rotation
- DNS / domain cutover

Risk は途中で新しい影響が見つかれば即時昇格する。
