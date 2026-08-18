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

原因未確認の blind retry をしない。
