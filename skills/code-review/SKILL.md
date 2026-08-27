---
name: code-review
description: REVIEW stage。compact contract・diff・Coverage Mapを使い、仕様/要件/test caseの漏れを先に探してからcorrectness/securityを確認する。
---

# REVIEW

## 起動条件

- R0: 原則NOT_REQUIRED
- R1: Controlが要求した時だけ
- R2: 1 independent reviewer
- R3: 1 independent risk-aware reviewer
- R4: 1 independent reviewer + Human Gate
- Implementationでmaterial new riskを発見した場合

通常のindependent reviewerは最大1体。

## Compact review packet

Reviewerへ渡すdefault input:

- AC / IV IDsと短いcontract
- relevant dimensions / material assumptions
- impact summary / Risk / Controls
- behavior-changing diff / behavior change map
- Coverage Map / TC結果 / Verification Evidence
- open Finding IDs
- reviewed revision

Issue全文・chat履歴・全Skill・全repoを毎回渡さない。

具体的なconflict / missing caller / missing boundaryが見つかった時だけsource探索を広げる。

## Review order

### 1. Omission scan

styleより先に漏れを確認する。

- AC / IVにimplementation surfaceが無い
- AC / IVにVerification Evidenceが無い
- behavior-changing diffにAC / IV / design deviationの対応が無い
- relevant dimensionのTCが無い
- happy pathだけで必要なboundary / denial / failureが無い
- Preserve対象を壊すcaller / serializer / validator / persistence経路がある
- scope外behavior changeが混入している

materialな漏れだけfindingにする。「念のため全部追加」はしない。

### 2. Correctness / boundary

- correctness / error
- async / race / stale state
- caller compatibility
- state transition
- test adequacy

### 3. Re:Me protected behavior

関連変更がある時だけ深掘りする。

- Auth0 authentication / Convex authorization境界
- sealed letter content visibility
- sent letter immutability
- exact scheduled time privacy
- private R2 access / attachment exposure
- delivery idempotency
- notification payload separation
- reply → future thread semantics

### 4. Frontend / Convex

Frontend:

- loading / empty / error
- navigation
- mobile UX
- a11y / reduced motion
- state propagation

Convex:

- validator / schema
- ownership / access assumption
- index / query shape
- idempotency / concurrent state
- caller contract

## Requirements gap / Test gap

- 必要behaviorがAC/IVに無い → `requirements_gap`、PREPAREへ
- AC/IVはあるがEvidenceが無い → `test_gap`

Reviewer自身が新仕様を暗黙に決めない。

## Security

通常はこのREVIEW内のsecurity rubricで確認する。

security controlが起動した場合だけ `skills/security-review/SKILL.md` を追加する。別serial Gateとして常時挟まない。

## Finding Ledger

所見は `task-state.findings[]` にstable IDで直接追加する。

同じfindingを別ledgerへ複製しない。review recommendationはfinal dispositionではなく、rootが同じrecordを更新する。

## Revision

content change後:

- delta review
- protected behavior / AC / Risk / Controls change、またはdeltaをbound不能 → affected scope full review

same tree/contentなら再review不要。

## 出力

```text
REVIEW
Status: PASS | BLOCKED | NOT_REQUIRED
Revision:
Required by:
Reviewer:
Omission scan:
Coverage checked: AC/IV IDs
Findings added:
Security specialist: used | not_required
Evidence:
```
