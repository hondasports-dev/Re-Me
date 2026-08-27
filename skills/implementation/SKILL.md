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
- required Human Gateがimplementation前に必要なら承認済み

前工程を長く再要約せず `task-state.prepare` を参照する。

Issue全文・chat履歴・Requirements Skill全文は、contractが無効化された根拠が出た時だけ再読する。

## Writer境界

- same shared diffのwriterは原則1体
- 複数writerはpath-disjointを証明できる時だけ
- 他taskの差分を混ぜない
- secret / local env / generated local artifactをcommitしない

## 実装

- AC / IVに必要な最小変更
- scope外refactorを混ぜない
- behavior change / bug fixでは必要ならRED/GREEN
- Re:Meの既存Product / Architecture contractを優先する
- Coverage Mapに無いbehaviorが必要と分かったら暗黙追加せずPREPAREへ戻す

## Early falsification

高コスト実装・E2Eより先にcheapな前提を潰す。

- owning `tsconfig`
- direct callerの引数 / 戻り値
- Convex validator / schema / persistence shape
- Auth0 / Convex authorization前提
- sealed/unsealed visibility境界
- delivery / notification state transition
- existing testの境界条件

material assumptionが誤りなら、押し切らずAC / IV / Risk / Controls / TCを更新する。

## Reverse coverage

Implementation終了時にbehavior-changing diffをcontractへ逆引きする。

```text
convex/letters.ts#get → AC01
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

production / irreversible effectならHuman Gateへ。

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
