---
name: requirements
description: PREPAREを所有し、Spec Confidence、scope、ID付きAcceptance Criteria/Invariant、Risk、Required Controls、Coverage Mapを一度だけ確定する。長文再読を避けつつ仕様・要件・test case漏れを早期検出する。
---

# PREPARE / Requirements

## 目的

実装前に「何を作るか」「何を守るか」「何を証明するか」を一度だけ決める。

所有するもの:

- Goal / In scope / Out of scope
- `ACxx` Acceptance Criteria
- `IVxx` Preserve / Invariant
- relevant requirement dimensions
- material assumptions
- Spec Confidence
- Risk / max observed Risk
- Required Controls
- compact Coverage Map
- `TCxx` Verification plan
- 必要十分な Impact summary

`C0` のままImplementationへ進まない。

## Instruction priority / autonomy

current explicit user instructionを、一般的なSkill guidanceより優先する。Safety invariantは別。

ユーザーがすでに許可したread-only discovery、reversible repository edit、review / fix、tests / verification、branch作成、requested / implied PR create/updateについて、このSkillだけを理由に追加permissionを要求しない。

質問やHuman Gateの前に、まず次を終える。

1. cheapな許可済みdiscovery
2. source priorityに沿った仕様復元
3. reversibleな準備
4. concrete alternativesとmaterial differenceの提示

その上でmaterial choiceが残る時だけC0としてHuman Gateへ進む。

## Context discipline

PREPARE後にsource本文を後工程へコピーしない。

- authoritative sourceはURL / path / Issue comment等の参照だけ残す
- AC / IV / TCはIDで引き継ぐ
- unchangedなGoal / scope / Risk / Controlsを各stageで再要約しない
- source再読はcontract conflict / requirements gap / unbounded impact時だけ

探索は狭く始める。

1. symbol / filename search
2. direct definition
3. direct caller
4. direct test
5. materialな未解決がある時だけ拡張

「漏れが怖いから最初から全repoを読む」はdefaultにしない。

## Mid-turn steering

作業中に追加ユーザー指示が来たら、current explicit user instructionとして取り込む。

- affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新
- unaffected contractとsame-content Evidenceは保持
- PREPAREを最初から無条件にやり直さない
- material choiceが新たに発生した時だけHuman Gateを検討

## Workspace Preflight

repository fileを変更するlocal taskでは `skills/workspace-preflight/SKILL.md` を使う。

GitHub connector等のAPI writeでは、専用task branch・base=`main`・task identity確認を同等Evidenceとする。

## Spec Confidence

- `C2 confirmed`: 目的・期待結果・主要ACが明確でmaterial conflictなし
- `C1 reconstructed`: docs / tests / current patternからmaterial choiceなしに復元可能
- `C0 unclear`: authorized discovery後も複数の妥当な成果物がありmaterial choiceが残る
- `C0 conflicted`: source reconciliation後もdesired stateについてauthoritative sourceが矛盾

Source priority:

1. current user instruction
2. latest explicitly approved spec / ADR
3. current Issue / comments
4. canonical docs
5. tests
6. current implementation / pattern

現在仕様が「BからAへ変更」と明示する場合、実装Bとの差はexpected deltaでありconflictではない。

## Material assumptions

実装結果を変えうる推測だけ記録する。

- cheapに確認できる → 実装前に確認
- sourceから一意に復元できる → C1 evidence
- authorized discovery後も複数のmaterial choiceが残る → C0

特にRe:Meでは次の意味を推測で決めない。

- sealed / unsealed visibility
- sent letter immutability
- delivery / notification state
- ownership / authorization
- exact scheduling privacy
- reply → future thread semantics

## Requirement completeness scan

runtime behavior変更では次を一度だけ `relevant` / `not_applicable` へ分類する。

- happy path
- boundary
- error / failure
- empty / loading
- auth / ownership
- persistence / state transition
- caller compatibility
- concurrency / idempotency
- navigation / accessibility

relevantな観点だけAC / IV / TCへ反映する。not_applicableは短い理由だけ残す。

### AC

1件1意味、user / callerから観測可能な期待結果にする。

```text
AC01: sealed letterは到着・開封前に本文を取得できない
AC02: 送信後の本文は変更できない
```

### Invariant / Preserve

今回壊してはいけないbehaviorだけID化する。

```text
IV01: notification payloadにletter contentを含めない
```

全プロダクトルールを毎task列挙しない。

## Coverage Map

runtime behavior変更、Required Controlあり、またはR2以上では作成する。

```text
AC01 → worker/routes/letters.ts#get → TC01, TC02
IV01 → notification outbox           → TC03
```

legacy Convex → D1 migration taskでは、Convexはsource / rollback対象として必要なsurfaceだけCoverage Mapへ含める。通常runtimeの正本として扱わない。

### Forward coverage

全AC / relevant IVに:

- Verification case、または
- 明示NOT_REQUIRED理由

を持たせる。

### Reverse coverage

Implementation終了時、全behavior-changing diffをAC / IV / design deviationへ対応させる。

## Test Case derivation

TCはrelevant dimensionから必要なものだけ作る。

- positive
- boundary
- negative / denial
- failure
- regression
- functional E2E

reversible / low-impact変更では、implementation detailを鏡写しするだけのTCを増やさない。observable AC/IVをmaterialに証明するものだけ作る。

user-visible画面・遷移・操作を変える場合は、変更した画面そのものを踏むPlaywrightをTCへ含める。

既存critical 3本があることを理由に、新規画面E2Eを省略しない。

## Independent Spec Review

最大1 reviewer。使うのは:

- C1復元後もmaterial choiceが残る
- protected behaviorを復元仕様で変更する

Reviewerへ渡すのはsource参照 + Goal/scope + AC/IV + material assumptions + relevant dimensions + TC案のcompact packet。

Riskが高いだけでreviewerを増やさない。R4だけを理由にspecialistを追加しない。

## Risk / Required Controls

RiskはBlast Radius / Data-Security / Reversibility / Uncertaintyの4軸。

Required ControlsはRiskとは別に選ぶ。

- `workspace_preflight`
- `security_review`
- `db_access_control`
- `destructive_or_stateful`
- `service_ops`
- `human_gate`
- `prompt_injection_guard`

Auth0 / Worker / D1 / R2 / legacy Convex migrationに触れただけで全High ceremonyにせず、必要なControlだけ追加する。

**R4分類だけではHuman Gateを追加しない。** Human Gateはproduction / irreversible / unresolved material choice等の具体的triggerへ束縛する。

## PREPARE PASS

- C1 / C2
- unresolved material choiceなし
- AC / relevant IVがID付き
- runtime behavior変更ならdimension分類済み
- required taskではCoverage Mapあり
- 全AC / relevant IVにTCまたはNOT_REQUIRED理由あり
- Risk / Controls / Verification plan確定

## 出力

```text
PREPARE
Status: PASS | BLOCKED
Workspace preflight:
Spec confidence:
Source refs:
Material assumptions:
Goal / In / Out:
AC IDs:
IV IDs:
Relevant dimensions:
Coverage Map:
Risk / max observed:
Controls:
TC IDs:
Independent spec review:
Human Gate:
Evidence:
```
