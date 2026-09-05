---
name: implementation
description: PREPAREのcompact contract（AC/IV/TC、Risk、Controls、Coverage Map）に従ってone-writerで最小差分を実装し、behavior-changing diffをcontractへ逆引きする。
---

# Implementation

## 前提

- Spec Confidence C1/C2
- PREPARE PASS
- repository changeならWorkspace Preflight PASS / documented API-branch Evidence
- AC / relevant IVがID付き
- material assumptions解消済み
- Risk / Required Controls / Verification plan記録済み
- specific Human Gate triggerがある場合は、対象operation開始前にHuman Gateの明示的な承認を取得済み

前工程を長く再要約せず `task-state.prepare` を参照する。

Issue全文・chat履歴・Requirements Skill全文は、contractが無効化された根拠が出た時だけ再読する。

## Authorized execution

ユーザーがすでに許可したreversible repository edit、review/fix、tests、branch/PR作業について追加permissionを要求せず、ACを満たす具体的な差分まで進める。

R4分類だけを理由にImplementationをHuman Gateで止めない。production / irreversible / bulk state mutation等のspecific triggerがある時だけ止める。

## Mid-turn steering

作業中に追加指示が来たら、その指示をcurrent explicit user instructionとして取り込む。

- affected Goal / scope / AC / IV / TC / Risk / Controlsだけ更新
- unaffected implementationとsame-content Evidenceは保持
- 全Implementationを最初からやり直さない
- material choiceが新たに発生した場合だけPREPARE / Human Gateへ戻る

## Writer境界

- same shared diffのwriterは原則1体
- 複数writerはpath-disjointを証明でき、wall-clock短縮にmaterialに効く時だけ
- cheap sequential workをsubagentへ分割しない
- 他taskの差分を混ぜない
- secret / local env / generated local artifactをcommitしない

## 実装

- AC / IVに必要な最小変更
- scope外refactorを混ぜない
- behavior change / bug fixではobservable contractを証明する必要がある時だけRED/GREENを使う
- reversible / low-impact変更でimplementation detailを鏡写しするだけのtestを先回りして増やさない
- Re:Meの既存Product / Architecture contractを優先する
- Coverage Mapに無いbehaviorが必要と分かったら暗黙追加せずPREPAREへ戻す

## Early falsification

高コスト実装・E2Eより先にcheapな前提を潰す。

- owning `tsconfig`
- direct callerの引数 / 戻り値
- Worker route / validator / D1 schema / persistence shape
- Auth0 / Worker authorization前提
- sealed/unsealed visibility境界
- delivery / notification state transition
- existing testの境界条件

legacy Convex → D1 migration taskでは、Convexはsource / rollback対象として必要な範囲だけ確認する。

material assumptionが誤りなら、押し切らずAC / IV / Risk / Controls / TCを更新する。

## Reverse coverage

Implementation終了時にbehavior-changing diffをcontractへ逆引きする。

```text
worker/routes/letters.ts#get → AC01
src/features/letters/Open.tsx → AC02, IV01
```

PASS条件:

- behavior-changing surfaceはAC / IV / design deviationへ対応
- formatting / generated / mechanical changeを無理に紐付けない
- 対応しないbehavior changeはscope creepまたはrequirements gapとしてPREPAREへ戻す

AC本文を再コピーせずIDだけ記録する。

## Re:Me protected behavior

次の変更を実装中に発見したらRisk / Controlsを即再評価する。

- sealed content visibility
- sent letter immutability
- ownership / access boundary
- exact `scheduledAt` privacy
- delivery idempotency
- notification content separation
- private R2 access
- reply / future thread semantics

production / irreversible / bulk state mutation effectが判明した場合は、effect実行前に停止してHuman Gateへ戻る。

## 終了確認

- intended filesのみ
- AC / IVと差分が対応
- reverse coverage成立
- design deviation説明済み
- newly observed risk反映済み
- TC / Verification plan更新済み
- unrelated dependency/refactorなし
- secret/local-only artifactなし

## 出力

```text
IMPLEMENTATION
Status: PASS | FAIL | BLOCKED
Changed files:
Behavior change map:
Design deviations:
Newly observed risk:
Controls / TC changed:
Evidence:
```