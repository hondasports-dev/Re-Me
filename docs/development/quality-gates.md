# Quality gates

実装 Issue の Done 条件として、変更内容に応じて以下を通す。

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Critical flow を変更する場合は `pnpm test:e2e` を実行する。user-visible な画面 / 遷移を足す・変える場合は、**変更した画面そのもの** を踏む Playwright が mandatory である。未実装の critical 3本や、変更していない login E2E の成功を省略理由・代替 evidence にしない。credential 不足は `NOT_REQUIRED` ではなく BLOCKED とする。

通常の Quality gates / `pnpm test` は local Supabase を起動しない。authorization / schema は `pnpm test:convex` で検証する。

## Convex gates

CI の Quality gates は `pnpm test:convex` を必須 step にする。`convex-test` の in-memory harness で authorization / schema を検証し、live Convex deployment は使わない。

Convex schema / function を変更する場合:

- `convex dev --once` 相当で target deployment へ push / validation
- generated API / TypeScript typecheck
- args / return validators
- index-backed bounded reads
- public / internal surface review
- changed authorization / state transition tests（`pnpm test:convex`）

## Required authorization tests

- unauthenticated denial
- User A / User B isolation
- sealed traveling / delivered-unopened content denial
- open 後の content access
- sent content immutability
- exact schedule non-exposure
- internal delivery / notification function non-public
- R2 upload / download capability ownership and expiry

## 今回変えた画面の E2E

user-visible な画面 / 遷移 / 操作を変えたら、その path を踏む Playwright を実行する。既存 spec が無いなら追加する。

## MVP までに揃える critical E2E

通常 E2E は Google OAuth UI を経由せず、Auth0 database test identity で session を作り `e2e/.auth/` に保存して使う。以下は MVP の下限であり、これ以外の画面の E2E を省略する根拠にはしない。

1. authenticated session → draft → send
2. sealed letter delivered → open → content visible
3. open → reply → send to future

## Google OAuth / Auth0 smoke

少数の smoke test で以下を確認し、外部 credential のない通常 CI では明示的に skip する。

1. Google OAuth login starts
2. Auth0 callback succeeds
3. token is issued
4. Convex validates issuer / audience / signature
5. authenticated query succeeds

## Delivery / notification

- overlapping cron で二重配送しない
- due / deleted / current state を再検証する
- delivery と outbox creation が atomic
- push failure は delivered state を戻さない
- stale generation completion を拒否
- retry / backoff / oldest pending monitoring を検証

## Cloudflare / R2

- SPA fallback と static asset build
- bucket 非公開
- sealed / unopened attachment URL の非公開
- MIME / size / dimension / EXIF handling
- metadata / object delete の partial failure reconciliation

## Production readiness

Production cutover 前に以下を別 gate とする。

- Auth0 DEV / PROD separation
- Convex deployment / env separation
- Cloudflare preview / production separation
- backup / export / restore rehearsal
- legacy Supabase data inventory and migration decision
- rollback plan
- quota / billing / alerting review
