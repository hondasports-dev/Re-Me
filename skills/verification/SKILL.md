---
name: verification
description: AC/IV/TCのCoverage Map、max observed Risk、Required Controlsに対応する最小十分な検証をfail-fast順で行い、requirements gapとtest gapを分離する。
---

# Verification

## 原則

「全部実行した」ではなく、**AC / relevant IVとrequired boundaryを証明した**ことをPASS条件にする。

PREPAREのCoverage Mapを使い、ここで仕様やtest caseをゼロから再導出しない。

required checksが通った後にcheckを広げたり繰り返したりするのは、次の時だけ。

- new content change
- material failure
- unresolved concern
- Required Controlが追加Evidenceを要求

それ以外はtask completionへ進む。

## Context discipline

通常読むのは:

- AC / IV / TC IDsと短いcontract
- behavior change map / changed files
- Risk / Controls
- Coverage Map
- current revision
- open findings

Issue全文・chat履歴・Requirements Skill全文はcontract conflict / requirements gap時だけ再読する。

## Fail-fast order

1. scopeable static / owning `tsconfig`
2. targeted unit / contract test
3. affected Worker / D1 integration test
4. required functional Playwright E2E
5. repo-wide regressionは原則CI Aftercare

上流失敗で下流結果が無意味になる場合、高価なcheckを先に走らせない。

修正後はdeltaで無効化されたcheckだけ再実行する。

## Low-impact test policy

reversible / low-impact変更で、implementation detailを鏡写しするだけの新規testを要求しない。

追加するtestはobservable AC / IVまたはRequired Controlをmaterialに証明するものだけにする。

ただし次は省略しない。

- Re:Me protected behaviorのboundary proof
- auth / ownership denial
- destructive / stateful failure path
- required browser E2E
- migration / data compatibility control

## Forward coverage

全AC / relevant IVについて:

- 対応TCまたは明示NOT_REQUIRED理由がある
- TCが実行されobservable contractを確認する
- multi-layer contractなら必要なboundaryまでEvidenceが届く

mock call回数や内部fieldだけではuser/caller contractの証明にならない場合がある。

## Reverse coverage

Implementationのbehavior change mapを確認する。

behavior-changing diffがAC / IV / design deviationへ対応しなければ `requirements_gap` としてPREPAREへ戻す。

## Requirements gap / Test gap

- `requirements_gap`: 必要behaviorがAC/IVに無い、またはdiffがcontract外 → PREPARE
- `test_gap`: AC/IVは明確やがProofが無い → test/evidence追加

Testが無いことを理由に仕様を無かったことにしない。

## Relevant dimensions

PREPAREで`relevant`になったものだけ確認する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

新Evidenceがない限り、`not_applicable`観点をここで再議論しない。

## Re:Me controls

### Auth / access

Auth0 / Worker authorization / ownership変更では許可経路だけでなくdenial / cross-userを確認する。

sealed letterは到着・開封前の本人にも本文/attachmentを返さないことをserver boundaryで検証する。

### Data / state

D1 schema / validator / ownership / delivery state変更ではaffected route / query / mutation相当のAPI path / callerを確認する。

sent letter immutability、delivery idempotency、notification separation、exact schedule privacyを関連変更時に検証する。

legacy Convex → D1 migrationではsource export / mapping / rollbackに必要な範囲だけConvex側Evidenceを取る。

### R2+

Riskとrelevant dimensionに応じて boundary / error / partial failure / state compatibilityを追加する。

## Browser E2E

user-visible画面・遷移・操作を変更した場合、**その画面・遷移そのもの**をPlaywrightで踏む。

既存critical E2E:

1. authenticated session → draft → send
2. sealed letter arrival → open
3. open → reply → send to future

この3本は下限であって上限ではない。新しい画面を変更・追加したら対応specを追加する。

次はEvidenceにならない。

- 変更していないlogin/別画面E2Eの成功
- unit / component / Worker testだけ
- 該当Playwright specが既存に無いこと

required credential / environment不足はNOT_REQUIREDにせずBLOCKED / Incident。
`pnpm loop:e2e-gate` が FAIL なら Verification は PASS にしない。
CI End-to-end を、変更した画面の local functional E2E の代替にしない。

Google OAuth UIをcritical E2Eへ毎回含めず、Auth0 test identity/sessionまたはbackend harnessを基本とする。

## CIとの分担

same contentのrepo-wide full checks / regression E2EはCI Aftercareを正本にできる。

localで同じfull suiteを重ねる場合は理由を記録する。

blind retryをしない。失敗原因を分類し、deltaに依存するcheckだけ再実行する。

## Finding Ledger

新しいgapにはstable IDを払い出す。

- `category: requirements_gap | test_gap`
- affected AC / IV
- observed revision
- evidence
- `open | fix_now`

同じgapはduplicateを作らず同じrecordを更新する。

requirements gapはPREPAREへ戻す。test gapは解決までPASS不可。Human Gateで迂回しない。

## Revision / mid-turn steering

same content Evidence再利用にはprevious/currentの非空tree SHA一致を必要とする。

- matching tree → reuse
- identity不明 → content changed扱い
- content changed → delta verification
- protected behavior / AC coverage / Risk / Controls change、またはdeltaをbound不能 → affected scope full rerun

作業中に追加ユーザー指示が来た場合も、affected contract / contentだけを再検証し、unaffected Evidenceを破棄しない。

## PASS

- forward coverage成立
- reverse coverage成立
- relevant dimensionのEvidenceあり
- Required Controlsのboundary証明済み
- blocking requirements/test gapなし
- required checks PASS

## 出力

```text
VERIFICATION
Status: PASS | FAIL | BLOCKED
Revision commit / tree:
Affected scope:
AC / IV results:
TC results:
Forward / reverse coverage:
Checks:
Skipped + reason:
Reruns + reason:
Finding IDs added/updated:
Evidence:
```
