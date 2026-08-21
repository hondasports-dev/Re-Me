---
name: verification
description: Acceptance Criteria・Risk・Required Controls に対応する最小十分な検証を行い、対象 revision と結果を記録する。
---

# Verification

品質は「全部実行したか」ではなく、**Acceptance Criteria と必要な boundary を証明できたか**で判断する。

## Standard checks

Repository-wide の候補:

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

ローカルでは変更範囲に必要な check を選ぶ。CI が同じ content に repository-wide required checks を実行するなら、理由なく同じ full suite を二重実行せえへん。

追加例:

- React UI / browser flow → targeted component/integration + 必要な Playwright E2E
- Worker / Hono → API / Worker test
- schema / RLS / RPC → migration / SQL / cross-user access-control test
- R2 object lifecycle → upload / delete / access boundary
- stateful / destructive → error path / idempotency / rollback or recovery evidence

## Profile

- R0: targeted static / diff check
- R1: changed / directly affected tests + scopeable static checks
- R2: affected scope
- R3: full affected scope including boundary / error cases
- R4: R3 + rollback / recovery evidence

Required Controls は profile に追加する。たとえば R2 でも RLS を変えるなら access-control test は必須や。

## Acceptance Criteria result

各 AC について `pass / blocked / not_applicable` と Evidence を記録する。実装詳細の検査だけで user-observable AC を証明したことにせえへん。

## Finding Ledger

Verification で defect や material test gap を見つけたら、`task-state.findings` に1件だけ追加する。同じ内容を `material_test_gaps` や residual-risk record に複製せえへん。

- defect → `category: correctness` など、`disposition: fix_now`
- material test gap → `category: test_gap`, `risk_domains: [test_gap]`, `disposition: fix_now`

`test_gap` は Human Gate で迂回せず、fix または Requirements / AC の正式変更後に再評価する。

## Revision / rerun

Verification は `revision.verified` に対象 commit/tree を記録する。

head が変わった場合:

1. tree が同じなら既存 evidence を再利用する。
2. content が変わったら変更 delta を確認する。
3. changed scope を targeted verify する。
4. protected behavior、AC coverage、Risk / Controls が変化した場合だけ必要な full affected scope を再実行する。

rebase や commit metadata 変更だけで full Verification をやり直さへん。

## Failure routing

- code defect → Implementation
- spec mismatch → PREPARE
- unknown / repeated failure → Incident
- required environment unavailable → BLOCKED
- material test gap → BLOCKED

原因未確認の blind retry はしない。
