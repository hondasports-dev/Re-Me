---
name: verification
description: Risk Profile と Acceptance Criteria に応じて、必要十分な検証を Evidence 付きで実行する。
---

# Verification

「全部実行すれば安全」ではなく、Risk と AC に対応する最小十分な検証を行う。テスト追加と実行 PASS は別物。

## 標準 check

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

変更範囲に応じて追加する。

- Vue UI / browser flow → targeted component/integration + 必要な Playwright 機能 E2E
- Worker / Hono → Worker test / API test
- Supabase schema / RLS / RPC → migration reset / SQL test / cross-user access test
- R2 → upload/delete/access boundary test
- PWA / Push → service worker / permission / notification flow test

## Profile

- R0: targeted static / diff check
- R1: changed / directly affected tests + scopeable static checks
- R2: affected scope の unit / integration / E2E
- R3: affected scope の正常・境界・error・auth denial・partial failure を full に確認
- R4: R3 + rollback / recovery evidence

同じ head で CI が repository-wide checks を正本として実行するなら、ローカルで同じ全量 suite を理由なく二重実行しない。

## E2E

Browser を跨ぐ AC がある場合は機能 E2E が required。代表例:

- Login / auth route
- draft → send
- sealed arrival → open
- reply → future send
- save / delete / navigation

unit / component だけで AC を証明できる場合は E2E NOT_REQUIRED と理由を記録する。

## Failure

- code defect → Implementation
- spec mismatch → Requirements
- unknown / repeated failure → Incident
- required environment unavailable → BLOCKED
- `test_gap` / material test gap（current AC / invariant を十分に証明できない未検証領域）→ BLOCKED。Human Gate で迂回せず、`risk_reconciliation` で defer や `non-must-fix` に分類して Verification PASS へ進めない。

Verification の対象 head を `verification.verified_head_sha` として current head に固定する。`verification.findings` と `material_test_gaps` の各 item は stable / unique な id を持ち、non-empty `test_gap` には `test_gap_id` を付ける。material gap の `test_gap_id` は item の `id` と同一にし、source finding がある場合は source の `test_gap` / `test_gap_id` と完全一致させる。AC、invariant、auth denial、state rollback、idempotency、atomicity、immutability、privileged boundary のいずれかに対する material gap は、matching `test_gap_id` の residual-risk record に failure scenario、影響、追加証拠を記録する。全 finding / gap id は一件以上の reconciliation record の `source_finding_ids` へ移送する。source の non-empty `test_gap` は `verification.material_test_gaps` にも同じ id と text で現れなあかん。source context を residual に統合する場合は `source_fidelity` の equal / explicit-superset relation と evidence を要求する。test gap は `fix_now`、または Requirements / AC の正式変更後に再評価する。head が変わった場合は、前の Verification PASS を再利用しない。

Verification evidence は `kind`、`source`、`ref_or_command`、`result`、`head_sha`、`observed_at` を持つ構造化 record にする。

原因未確認の blind retry をしない。
