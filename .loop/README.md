# Re:Me Agent Loop v4

Re:Me Agent Loop v4 は、v3 の Risk-based / deterministic enforcement 方針を維持しつつ、次を強化する。

1. **Context削減** — stage間で長文を再要約せず、ID付きcompact contractだけ引き継ぐ
2. **高速化** — cheap check → targeted test → integration → E2E → CIのfail-fast順
3. **漏れ検出** — AC / Invariant / Test CaseをIDで結び、forward / reverse両方向で不足を探す
4. **Timing telemetry** — stage時間をRisk / Spec Confidence / task sizeと一緒に改善Evidenceへ使う

正本:

- `AGENTS.md` — 常時保持する最小のloop不変条件 + Re:Me固有Product/Architecture contract
- `.loop/process.yaml` — compactな機械可読contract
- `.loop/templates/task-state.yaml` — Coverage Map / Finding / telemetry
- `skills/*/SKILL.md` — current stateの詳細
- `scripts/check-loop-evidence.mjs` / `scripts/check-task-worktree.mjs` — deterministic enforcement

## Design principle

```text
Quality = confirmed contract
        + forward coverage
        + reverse coverage
        + Required Controls
        + Verification Evidence
        + blocking finding = 0
```

Gate数・Agent数・文書量を品質指標にしない。

```text
PREPARE → IMPLEMENT → VERIFY → REVIEW? → DELIVER → AFTERCARE → DONE
```

Human Gate / Incident / Process Learningは必要時だけ。

---

## Compact contract

PREPARE後に渡す情報を次へ絞る。

- Goal / scope
- `ACxx` Acceptance Criteria
- `IVxx` Preserve / Invariant
- material assumptions
- relevant dimensions
- Risk / Required Controls
- Coverage Map / `TCxx`
- open Finding IDs
- current revision

Issue全文・chat履歴・source本文を各stageで再要約しない。sourceは参照だけ残す。

source再読はcontract conflict / requirements gap / unbounded impact等の具体的理由がある時だけ。

Conditional Skillもtrigger時だけ読み、使用後はactive contextから外してよい。

## Requirements completeness

runtime behavior変更では一度だけ次を`relevant` / `not_applicable`へ分類する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

relevantなものだけAC / IV / TCへ反映する。

Re:Meでは特に次の意味を推測で決めない。

- sealed / unsealed visibility
- sent letter immutability
- ownership / authorization
- exact schedule privacy
- delivery / notification state
- reply → future thread semantics

## Coverage Map

```text
AC01 → convex/letters.ts#get → TC01, TC02
IV01 → notification outbox  → TC03
```

### Forward coverage

`AC / relevant IV → Test / Evidence`

全contractにVerification caseまたは明示NOT_REQUIRED理由を必要とする。

### Reverse coverage

`behavior-changing diff → AC / IV / design deviation`

対応しないbehavior changeはscope creepまたはrequirements gapとしてPREPAREへ戻す。

## Requirements gap / Test gap

- **requirements gap**: 必要behaviorがAC/IVに無い、またはdiffがcontract外 → PREPAREへ戻る
- **test gap**: AC/IVは明確やがProofが無い → test/evidenceを追加

Testが無いことを理由に仕様を無かったことにしない。

## Fail-fast Verification

```text
scopeable static / owning tsconfig
  ↓
targeted unit / contract
  ↓
affected Convex / integration
  ↓
required functional Playwright
  ↓
repo-wide regression = CI Aftercare
```

material failureがあれば無意味な下流checkを止める。

same contentのEvidenceは再利用し、content deltaが無効化した範囲だけ再検証する。

### Re:Me browser E2E

critical E2Eの下限:

1. authenticated session → draft → send
2. sealed letter arrival → open
3. open → reply → send to future

この3本は上限ではない。user-visible画面・遷移・操作を追加/変更したら、その画面を踏むPlaywrightを追加する。

変更していない別画面のE2E成功をEvidenceにしない。

## Omission-first Review

通常のindependent reviewerは最大1体。

Reviewerへ渡すのはcompact packetだけ。

最初に探すもの:

- AC/IVに実装surfaceが無い
- AC/IVにEvidenceが無い
- diffがAC/IV/design deviationへ対応しない
- relevant dimensionのTCが無い
- 必要なboundary / denial / failureが抜けている
- Preserve経路を壊すcaller / validator / persistence経路
- scope外behavior change

具体的不足が出た時だけsource探索を広げる。

## Finding Ledger

`.loop/templates/task-state.yaml` の `findings[]` が唯一の正本。

requirements gap / test gap / Review / CI findingを別表へ複製しない。

同じfindingはstable IDの同じrecordを更新する。

## Timing telemetry

stage開始・終了と少数counterだけ記録する。

```text
PREPARE        92s
IMPLEMENT     310s
VERIFY        184s
REVIEW         61s
DELIVER        22s
AFTERCARE     240s  (external wait 205s)
```

主な値:

- started / finished / elapsed
- external wait + reason
- source reads / skill loads
- changed files
- AC / IV / TC / Controls数
- findings / retries / full suite runs / review cycles

DONE時にRisk・Spec Confidence・task sizeと一緒にcompact summaryを表示する。

```text
Spec: C2 | Risk: R2 (max R2) | Size: small
Files: 4 | AC: 3 | IV: 1 | TC: 6 | Controls: 1
Prepare 1m32s | Implement 5m10s | Verify 3m04s | Review 1m01s
Deliver 22s | Aftercare 4m00s (external wait 3m25s)
Total 15m09s | Active 11m44s | Retries 1 | Full suites 0 | Review cycles 1
```

時間だけで良し悪しを決めない。CI / Human Gate / external service待ちは可能ならexternal waitへ分離する。

Token usageはruntimeが正確に提供する場合だけoptionalで記録する。

Telemetryだけを理由にProcess Learningを起動しない。Learning Eventがある時だけ、同程度のRisk / Spec / sizeに対してstage時間やretryの偏りを改善Evidenceとして使う。

## Deterministic enforcement

```bash
pnpm loop:preflight
pnpm test:loop
```

機械判定可能なルールはdocumentだけに依存しない。

ただしscriptと正本contractが矛盾した場合は、scriptへ合わせて仕様を曲げず `.loop/process.yaml` / Requirementsを確認してenforcement側を直す。

## Re:Me invariants kept

軽量化しても削らない。

- C0で実装しない
- `main`直編集禁止 / dedicated branch
- shared diff one writer
- sealed letter access boundary
- sent letter immutability
- authorization / ownership boundary
- delivery idempotency / notification separation
- private R2 / content privacy
- forward / reverse coverage
- required Verification / Review
- test gapのHuman Gate迂回禁止
- production / irreversible Human Gate
- latest PR contentがmerge-readyになるまでAftercare

v4の狙いは**チェックを増やすことではなく、同じ情報を何度も読まず、安い段階で漏れを見つけ、どこに時間が消えたかを比較可能にすること**や。
