---
name: process-learning
description: Learning Eventが実際に発生したtaskだけ、成果物の問題とループ中の無駄・誤判断を振り返り、telemetryを再利用可能な改善Evidenceとして使う。Risk R3/R4だけを理由に起動しない。
---

# Process Learning

## Event-driven only

次のEventが1つ以上ある時だけ起動する。

- human correction
- unexpected Gate / CI / E2E failure
- actionable review finding
- repeated retry / Incident
- scope / impact miss
- delivery / aftercare miss
- process rule / enforcement不足が明確になった

Eventなし:

```text
Learning event: none
Status: NOT_REQUIRED
```

Risk R3/R4だけでは起動しない。

## Telemetryを先に見る

`task-state.telemetry` がある場合、full logやchatを読み返す前にstage summaryを見る。

- PREPARE / IMPLEMENT / VERIFY / REVIEW / DELIVER / AFTERCARE elapsed
- external wait
- source reads / skill loads
- retries / full suite runs / review cycles
- changed files / AC / IV / TC / Controls / findings数
- Spec Confidence / Risk / max observed Risk / task size

時間単体で良し悪しを決めない。同程度の規模・Risk・Spec Confidenceに対して、どこへ時間・retry・再読込が偏ったかを見る。

例:

- PREPARE長い + source_reads多い → discoveryやcompact contractを疑う
- VERIFY長い + full_suite_runs複数 → fail-fast順 / CI evidence reuseを確認
- REVIEW長い + review_cycles多い → omission scanやcontract不足を確認
- AFTERCARE長い + external_wait比率高い → Agent loop自体の遅さと混同しない
- IMPLEMENT長い + requirements_gap → PREPAREで早期検出できたか確認

wall-clockにはtool/API/CI待ちが含まれる。分離できない時間を推測しない。

Token usageはruntimeが正確に提供する時だけ補助Evidenceにする。

## 分析

```text
Observed problem:
Immediate cause:
Process cause:
Why existing enforcement did not catch it:
Earlier detection / prevention:
Reusable rule:
```

## Loop retrospective

目的は3つだけ。

- `context`: 読み込む情報・保持状態・重複説明を減らす
- `speed`: tool round-trip、待機、重複実行、手戻りを減らす
- `precision`: scope miss、requirements gap、test gap、false completionを減らす

新たに全ログを読み直さず、task-state / telemetry / findings / Verification Evidence / 既存tool結果を使う。

影響の大きいものを最大3件まで。

- 無駄な判断・行動
- 間違った判断
- 維持すべき判断

hindsightだけで言えるものと、当時のEvidenceから回避可能やったものを分ける。改善候補は回避可能なものを優先する。

改善は「手順追加」より先に:

- 削除
- 統合
- delayed loading
- 順序変更
- Evidence reuse
- cheap deterministic check

を検討する。Required Controlや品質Gateを速度目的で弱めない。

## Target priority

1. Script / code
2. CI / deterministic enforcement
3. Skill
4. AGENTS policy
5. Runbook / docs

既存ruleを破っただけなら文章追加よりenforcement改善を優先する。

## Result persistence

再利用可能な候補をchat上の提案だけで終わらせない。

各候補に:

- observed problem / process cause
- reusable rule
- improvement axes
- proposed target
- disposition
- evidence

を記録する。

Disposition:

- `applied`: loop artifactへ反映済み。location + verification evidence必須
- `follow_up`: current task scope外。Issue / task / PRのtype・reference + target + rationale必須
- `no_change`: 既存enforcementで充足済み、または再利用不能。rationale + evidence必須

candidateがあるのに`pending`、またはchatだけで永続反映先が無い場合PASSにしない。

ユーザーがcurrent PRへの反映を明示した場合だけ同PRへ実装し、delta Verification / Review / Aftercareまで行う。

## 出力

```text
PROCESS LEARNING
Status: PASS | NOT_REQUIRED
Events:
Telemetry signal:
Loop retrospective:
  Unnecessary decisions/actions:
  Incorrect decisions:
  Decisions to retain:
  Next-loop adjustments:
Candidates:
  Observed problem:
  Process cause:
  Reusable rule:
  Improvement axes:
  Proposed target:
  Disposition:
  Location / persistent follow-up:
  Verification evidence:
Evidence:
```
