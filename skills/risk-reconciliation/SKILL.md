---
name: risk-reconciliation
description: Review と Verification の findings / residual risks を root が採否・対応方針へ統合し、Delivery 前の unresolved risk を deterministic に遮断する。
---

# Risk Reconciliation

`CODE_REVIEW` / `SECURITY_REVIEW` の後、`DELIVERY` の前に実行する。目的は reviewer のラベルを採用可否と取り違えず、current head 上の全 finding を Delivery 判定へ反映することや。

## Ownership

- Reviewer は finding、failure scenario、invariant / AC への影響、test gap、evidence、推奨 disposition を記録する。
- Reviewer の `PASS`、`nice_to_have`、`non-must-fix` は finding を消す最終 disposition ではない。
- 最終 disposition と Gate 判定は root が task の scope、AC、invariant、Verification evidence を突き合わせて決める。

各 record は少なくとも次を持つ:

```text
id / finding / failure_scenario / affected_invariants /
affected_acceptance_criteria / risk_domains / classification_required /
test_gap / test_gap_id /
source_finding_ids / source / evidence / disposition / rationale /
mitigation / safe_failure_or_unreachable / follow_up_issue /
not_applicable_proof / current_head_evidence / human_approval
```

Reviewer の recommendation と root の final disposition を同じ値で上書きせず、`recommended_disposition` と `disposition` を分ける。

`verification.material_test_gaps` の各 item は stable `id` を持ち、対応する residual record の `test_gap_id` と一対一で結び付ける。

```text
id / test_gap / test_gap_id / finding / failure_scenario /
affected_invariants / affected_acceptance_criteria / evidence
```

Code Review、Security Review、Verification の `findings` / `material_test_gaps` は全て stable かつ unique な id を持つ。各 id は1件以上の reconciliation record の `source_finding_ids` に移送し、reconciliation 側の source id も入力側に実在せなあかん。label や summary 配列だけでは移送済みとみなさへん。

Security Review に `security_review.residual_risks` という summary 経路はない。structured `security_review.findings` だけを source とし、互換入力で summary residual が non-empty なら移送不備として BLOCK する。

## Source fidelity

各 source finding / gap を residual record へ移すときは、内容を都合よく縮めたらあかん。`source_finding_ids` の各リンクについて、次を deterministic に照合する。

- `test_gap` と `test_gap_id` は source と完全一致。source が non-empty なら `verification.material_test_gaps` に同じ id と同じ gap text を持つ item が必須や。
- source の protected `risk_domains` は residual に全て含める。`availability`、`performance`、`maintainability`、`ux`、`compatibility`、`operations`、`documentation`、`reliability`、`observability` は非保護 domain で、証拠付き `defer_with_evidence` の対象になり得る。`other` は未分類の protected domain や。
- `failure_scenario`、`affected_invariants`、`affected_acceptance_criteria` は source と同じか、明示的な superset にする。拡張・統合で source より広げる場合は `source_fidelity` に `relation: explicit_superset` と evidence を記録し、欠落や弱化は BLOCK や。
- `source_fidelity` は各 source id に対応する一意の record とし、source id の捏造・孤立も BLOCK。code / security / verification の全 finding と gap に同じルールを適用する。

## Disposition rules

許可する disposition は `pending`、`fix_now`、`defer_with_evidence`、`accept_with_human_gate`、`not_applicable` のみ。

- `pending` が1件でもあれば Reconciliation は BLOCKED。Delivery へ進めない。
- `fix_now` は Implementation に戻し、修正後に Verification → Reviews → Reconciliation を同じ順序でやり直す。
- `defer_with_evidence` は、現在の invariant / AC を壊さない証拠、failure scenario が到達不能または safe failure である証拠、具体的 mitigation、follow-up issue、current head の再現可能な evidence が全て揃う場合だけ許可する。
- `accept_with_human_gate` は、protected domain の finding であっても material `test_gap` がない場合だけ候補にできる。approver、approved_at、scope、approval evidence が揃うまで BLOCKED で、承認後も finding と rationale を Delivery evidence に残す。
- `not_applicable` は finding が成立しない `not_applicable_proof`、rationale、evidence、current-head evidence を記録する。単なる `non-must-fix` への置換には使わない。

`test_gap` は Human Gate で迂回できへん。non-empty の `test_gap` は必ず `fix_now`（または Requirements / AC の正式変更を先に完了して再評価）にする。Verification は PASS にせず BLOCKED のままや。

次の protected domain に該当する finding は agent 単独で `defer_with_evidence` にできへん。`fix_now` または `accept_with_human_gate`（承認待ちは BLOCKED）にする:

```text
invariant, auth, authentication, authorization, rls, data_integrity,
state_rollback, idempotency, atomicity, immutability,
privileged_boundary, current_scope
```

`test_gap` は別扱いで protected domain とし、Human Gate 候補から除外する。`fix_now` または Requirements / AC 再評価だけを許可する。

`other` は未分類の protected domain として扱う。rationale だけで `defer_with_evidence` にせず、known protected domain が affected invariant / AC / failure scenario から判定できる場合は対応する enum を `risk_domains` に併記する。分類できない間は `classification_required` evidence を付けたうえで `fix_now` または（test gap なしの）`accept_with_human_gate` だけを候補にする。

## Gate decision

1. Code / Security Review と Verification の全 record を回収し、reviewer の分類に関係なく一件ずつ reconciliation record にする。
2. R3/R4、review finding、residual risk、material test gap のいずれかがあれば `risk_reconciliation.required: true` を記録する。trigger があるのに false / 未記録なら BLOCKED。
3. residual risk record と `verification.material_test_gaps` の id は non-empty かつ一意で、各 gap id と `test_gap_id` が matching することを検証する。id 欠落、重複、孤立 gap、逆向きの孤立 reference は BLOCKED。
4. `test_gap` が一つでも記録されている場合は Verification を PASS にせず BLOCKED。Human approval / `accept_with_human_gate` で迂回せず、`fix_now` または Requirements / AC 正式変更後の再評価へ戻す。
5. `pending`、`fix_now`、未承認の `accept_with_human_gate`、または必須 evidence 欠落があれば BLOCKED。
6. 残存 risk がゼロの fast path でも、`no findings / no residual risks / no test gap / no unresolved items` と current head 一致を明示した PASS evidence を残す。
7. `defer_with_evidence` は条件と evidence が全て検証済み、`not_applicable` は成立しない rationale・evidence・current-head binding が検証済みなら通過できる。

R3 / R4、または review finding / residual risk がある task はこの Gate を省略せえへん。R0-R2 の残存ゼロだけが上記 fast path の対象や。

## Blocker precedence

複数の問題がある場合は、次の順で最初の blocker を優先して記録する。

1. material test gap → Verification BLOCKED、`fix_now` または Requirements / AC 正式変更後の再評価。
2. incomplete record / finding transfer / head evidence → Reconciliation BLOCKED。
3. `pending` / `fix_now` residual → Implementation required、Delivery BLOCKED。
4. eligible な `accept_with_human_gate` の未承認 → Human Gate required、Delivery BLOCKED。
5. 全条件が clear の場合だけ PASS。

## Head binding

`task-state.current_head_sha`、`verification.verified_head_sha`、Code / Security Review の `reviewed_head_sha`、`risk_reconciliation.reconciled_head_sha`、`delivery.published_head_sha`、`pr_aftercare.observed_head_sha` を、該当 Gate で全て non-empty の full git object id（通常40桁）として記録する。各 id には `head_evidence` の source、ref_or_command、result、head_sha、observed_at が必要や。

Local evidence は `git rev-parse HEAD`、remote PR evidence は GitHub の `headRefOid` を使う。Review / Reconciliation では current / verified / code_reviewed / security_reviewed / reconciled、post-publish Delivery では published、Aftercare では observed まで全て一致させる。empty 同士の一致は PASS に数えへん。

各 `head_evidence.head_sha` は対応する state field と同一で、result はその command / API response の成功を示すこと。空欄、短縮 SHA、古い observed_at、head field と evidence の不一致は BLOCKED や。

PR Aftercare 中に latest PR head が変わった場合も、Verification / Reviews / Reconciliation / Delivery / Aftercare evidence は無効として、変更を含めて必要な工程から再実行する。古い head の PASS を Delivery の根拠にしたらあかん。

## Evidence records

Evidence は `kind`、`source`、`ref_or_command`、`result`、`head_sha`、`observed_at` を持つ構造化 record にする。`defer_with_evidence` は `mitigation`、`safe_failure_or_unreachable`、`follow_up_issue`、current-head evidence を全て non-empty にする。`not_applicable` は proof と current-head evidence が必須や。Human approval は `approver`、`approved_at`、`scope`、`evidence` を持ち、test gap には作らへん。

出力は task-state の `risk_reconciliation.status`（`pending` / `blocked` / `pass`）、trigger 時の `required: true`、`reconciled_head_sha`、全 record、`unresolved_items`、evidence に記録する。
