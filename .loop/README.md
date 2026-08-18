# Re:Me Agent Loop

`hondasports/kakeibo` の risk-based Agent Loop を Re:Me 向けに移植・簡素化したもの。

正本:

- `AGENTS.md` — 実行契約の入口
- `.loop/process.yaml` — state / risk profile / gate の正本
- `skills/*/SKILL.md` — 各工程の手順
- `.loop/templates/task-state.yaml` — Evidence 記録テンプレート

## Design principle

```text
Cheap deterministic checks
        → always / broadly applied

Expensive reasoning / multi-agent checks
        → risk or learning event driven
```

Gate 数を増やすことを品質と同一視しない。

## Intake

```text
TASK
 ↓
SPEC CONFIDENCE
 ├ C2 confirmed ─────┐
 ├ C1 reconstructed ─┤
 ├ C0 unclear ─→ Requirements Discovery / Human Gate
 └ C0 conflicted → Source Reconciliation / Human Gate
                      ↓
                 C1 / C2 only
                      ↓
                 RISK CLASSIFICATION
```

### Spec Confidence

- `C2`: 目的・期待結果・ACが明確で material conflict なし
- `C1`: 不足を docs / tests / existing pattern からほぼ一意に復元可能
- `C0 unclear`: 複数の妥当な成果物がある
- `C0 conflicted`: desired state について authoritative source が矛盾

`C0` のまま実装へ進まない。

## Risk model

4軸を `0..2` で評価する。

1. Blast Radius
2. Data / Security
3. Reversibility
4. Uncertainty

- `0..2` → R1
- `3..4` → R2
- `5..8` → R3
- R0 / R4 は明示条件

Re:Me では特に auth / RLS / schema / migration / secret / external write は原則 R3 floor。
production DB migration、不可逆 data mutation、account deletion、production secret rotation、DNS cutover は R4。

## Profiles

### R0 TRIVIAL

```text
PREFLIGHT → MINIMAL PLAN → CHANGE → TARGETED CHECK → DELIVERY → AFTERCARE
```

### R1 FAST

```text
PREFLIGHT
→ PLAN (Requirements + Impact)
→ IMPLEMENT
→ TARGETED VERIFY
→ REVIEW (Code + Security quick scan)
→ DELIVERY / AFTERCARE
```

### R2 STANDARD

```text
PREFLIGHT
→ REQUIREMENTS
→ IMPACT
→ IMPLEMENT
→ VERIFY
→ CODE REVIEW + Security quick scan
→ DELIVERY / AFTERCARE
```

### R3 HIGH

```text
PREFLIGHT
→ REQUIREMENTS + independent review x2
→ IMPACT
→ IMPLEMENT
→ FULL VERIFY
→ CODE REVIEW
→ SECURITY REVIEW
→ DELIVERY / AFTERCARE
→ PROCESS LEARNING
```

### R4 CRITICAL

R3 + independent review x3 + post-synthesis review + Human Gate + rollback / recovery evidence。

## Delivery

PR 作成で task を完了扱いにしない。

```text
DELIVERY
  ↓
PR_AFTERCARE latest head
  ├ required CI
  ├ actionable review
  ├ requested changes
  ├ approval
  └ mergeability
  ↓
merge_ready
```

ユーザーが明示的に「PR作成まで」と指定した場合だけ Aftercare を省略可能。

## Process Learning

R0-R2 は event-driven。Event がなければ `none` で閉じる。

Full analysis trigger:

- human correction
- Gate / CI / E2E failure
- actionable review finding
- retry / incident
- scope / impact miss
- delivery / task transition miss
- R3 / R4
