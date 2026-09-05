# Re:Me Agent Loop v5

Re:Me Agent Loop v5 は、v4 の Risk / Evidence / deterministic enforcement 方針を維持しつつ、kakeibo Agent Loop v12 と GPT-6 Astra のモデルガイドを参考に、**止まりにくさ・指示追従・検証の適正化**を強化する。

1. **Instruction priority** — current user instruction を一般的なSkill guidanceより優先し、曖昧なSkill文言で作業を止めない
2. **Autonomy** — 許可済みのread-only / reversible / review / fix / PR作業は追加確認なしでconcrete resultまで進める
3. **Mid-turn steering** — 作業途中の追加指示で全loopをrestartせず、affected contract / Evidenceだけdelta更新する
4. **Calibrated verification** — low-impact変更で実装を鏡写しするだけのtestや、PASS後の無根拠なfull check拡大を避ける
5. **Focused delegation** — subagentはwall-clock短縮か独立coverage改善にmaterialに効く時だけ使う
6. **Re:Me protected behavior** — sealed content、immutability、authorization、delivery idempotency、private R2等の強い境界は削らない

正本:

- `AGENTS.md` — 常時保持する最小のloop不変条件 + Re:Me固有Product/Architecture contract
- `.loop/process.yaml` — compactな機械可読contract
- `.loop/templates/task-state.yaml` — Coverage Map / Finding / telemetry
- `skills/*/SKILL.md` — current stateの詳細
- `scripts/check-loop-evidence.mjs` / `scripts/check-task-worktree.mjs` / `scripts/check-local-e2e-gate.mjs` / `scripts/sync-worktree-e2e-env.mjs` / `scripts/check-pr-aftercare.mjs` — deterministic enforcement

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

Human Gate / Incident / Process Learningは具体的trigger時だけ。

---

## Instruction priority

優先順位は次の通り。

1. platform / non-bypassable safety
2. current explicit user instruction
3. latest explicitly approved spec / ADR
4. `AGENTS.md` / `.loop/process.yaml`
5. current / triggered Skill
6. explanatory docs

Skillは、すでにユーザーが許可したreversible/read-only/review/fix/PR作業を独自に狭める権限として扱わない。

Skillがpermission確認・停止・未完了を要求すると解釈した場合は、exact `SKILL.md` pathと該当箇所を示して、その解釈が本当にmaterialか確認する。

Safety invariantはこの優先順位で上書きしない。

## Autonomy / Human Gate

次は追加permissionなしで進める。

- read-only discovery
- reversible repository edit
- review / fix
- tests / verification
- dedicated branch作成
- requested / implied PR create or update

質問や承認要求の前に、cheapな許可済み調査とreversibleな準備を終え、具体的なreviewable resultを作る。

Human Gateは次のような**具体的trigger**へ束縛する。

- authorized discovery後もmaterial choiceが残る
- production write
- irreversible / bulk state mutation
- production secret / credential rotation
- production DNS / domain cutover
- production data migration / cutover
- protected findingのaccept

**R4分類だけではHuman Gateを起動しない。**

## Mid-turn steering

作業途中で新しい指示が来たら、それをcurrent explicit user instructionとして取り込む。

- affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新
- unaffected contractとsame-content Evidenceは保持
- 全loopを無条件にrestartしない
- material choiceが新規発生した時だけPREPARE / Human Gateへ戻る

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

## Delegation

same shared diffのwriterは原則1体。

subagent / independent reviewerは、次のどれかにmaterialに効く時だけ使う。

- read-only discoveryを並列化してwall-clockを短縮
- required independent reviewでcoverageを改善
- path-disjoint analysisを安全に分離

cheap sequential work、simple search、同じEvidenceの重複要約には使わない。
R4だけを理由にreviewer / specialist数を増やさない。

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
AC01 → worker/routes/letters.ts#get → TC01, TC02
IV01 → notification outbox           → TC03
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
affected Worker / D1 integration
  ↓
required functional Playwright
  ↓
repo-wide regression = CI Aftercare
```

material failureがあれば無意味な下流checkを止める。

same contentのEvidenceは再利用し、content deltaが無効化した範囲だけ再検証する。

required checksが通った後にcheckを広げたり繰り返したりするのは、次の時だけ。

- new content change
- material failure
- unresolved concern
- Required Controlが追加Evidenceを要求

reversible / low-impact変更では、implementation detailを鏡写しするだけの新規testを要求しない。observable AC/IVをmaterialに証明するtestだけ追加する。

ただしRe:Meのprotected behaviorやrequired browser E2Eをこの方針で省略しない。

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
Specialist追加はmaterially distinctなControlがある時だけ。R4だけを理由に増やさない。

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

時間だけで良し悪しを決めない。CI / Human Gate / external service待ちは可能ならexternal waitへ分離する。

Token usageはruntimeが正確に提供する場合だけoptionalで記録する。

Telemetryだけを理由にProcess Learningを起動しない。Learning Eventがある時だけ、同程度のRisk / Spec / sizeに対してstage時間やretryの偏りを改善Evidenceとして使う。

## Deterministic enforcement

```bash
pnpm loop:preflight
pnpm loop:e2e-gate
pnpm test:loop
pnpm loop:aftercare
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

v5の狙いは**品質Gateを減らすことではなく、意味のない停止・重複・過剰検証を削り、Re:Me固有の重要境界へEvidenceを集中すること**や。
