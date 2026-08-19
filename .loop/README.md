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
PREFLIGHT → MINIMAL PLAN → CHANGE → TARGETED CHECK
           → RISK RECONCILIATION (fast path)
           → DELIVERY → AFTERCARE
```

### R1 FAST

```text
PREFLIGHT
→ PLAN (Requirements + Impact)
→ IMPLEMENT
→ TARGETED VERIFY
→ REVIEW (Code + Security quick scan)
→ RISK RECONCILIATION (fast path when no finding / residual / test gap)
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
→ RISK RECONCILIATION
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
→ RISK RECONCILIATION
→ DELIVERY / AFTERCARE
→ PROCESS LEARNING
```

### R4 CRITICAL

R3 + independent review x3 + post-synthesis review + Human Gate + rollback / recovery evidence + Risk Reconciliation。

## Risk Reconciliation

Review と Verification の後、Delivery の前に root が全 finding / residual risk を current head 上で統合する。Reviewer の `PASS`、`nice_to_have`、`non-must-fix` は推薦ラベルであって、最終 disposition ではない。

- `pending` / unresolved は一件でも Delivery BLOCKED。
- `fix_now` は Implementation → Verification → Reviews → Reconciliation をやり直す。
- `defer_with_evidence` は current invariant / AC 非破壊、到達不能または safe failure、mitigation、follow-up issue、current-head evidence が揃う場合だけ許可する。
- `accept_with_human_gate` は protected domain の finding であっても material `test_gap` がない場合だけ候補で、承認 evidence が揃うまで BLOCKED。test gap は Human Gate で迂回できず、`fix_now` または Requirements / AC 正式変更後の再評価に戻す。
- R3/R4、review finding、residual risk、material test gap のいずれかがあれば `risk_reconciliation.required: true` が必須。false / 未記録なら BLOCKED。
- `material_test_gaps` と residual record の id は stable / unique で、matching `test_gap_id` の residual record が必要。孤立 gap / reference は BLOCKED。
- `not_applicable` は成立しない rationale・evidence・current-head binding が揃わなければ BLOCKED。risk domain は enum 外を `other` と説明なしに置けない。
- Security Review は structured `findings` が唯一の入力経路で、`security_review.residual_risks` の summary-only 経路は廃止。Review / Verification の全 finding・gap id は reconciliation record の `source_finding_ids` へ移送し、逆向きの未知 source id も BLOCKED。
- source の `test_gap` / `test_gap_id` は residual へ完全一致で移送し、source の protected `risk_domains` を全て保持する。`failure_scenario` / affected invariants / AC は同値または明示的 superset evidence が必須で、source gap は同じ id / text の `verification.material_test_gaps` にも必要や。
- `other` は未分類 protected domain。`availability`、`performance`、`maintainability`、`ux`、`compatibility`、`operations`、`documentation`、`reliability`、`observability` は非保護分類で、条件を満たす `defer_with_evidence` の対象になり得る。known protected domain は enum を併記する。
- defer は mitigation / safe-failure-or-unreachable / follow-up issue / current-head evidence、Human Gate は approver / approved_at / scope / evidence を構造化して揃える。
- `test_gap` が一つでもあれば Verification PASS にせず BLOCKED とする。
- R0-R2 の review finding / residual がない task は、残存ゼロ・test gap なし・head 一致を明示する安価な fast path を使える。R3/R4 または finding / residual がある task は Gate を省略しない。
- `current_head_sha`、`verification.verified_head_sha`、各 Review の `reviewed_head_sha`、`reconciled_head_sha`、`published_head_sha`、`observed_head_sha` は該当 Gate で full git object id と kind / source / ref_or_command / result / head_sha / observed_at evidence を持ち、空文字同士を含め一致必須。PR Aftercare 中に latest PR head が変わったら Delivery / Aftercare evidence も無効化し、Verification → Reviews → Reconciliation → Delivery → Aftercare を再実行する。
- Local head は `git rev-parse HEAD`、remote PR head は GitHub `headRefOid` を source evidence にする。

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
