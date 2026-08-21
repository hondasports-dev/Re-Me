# Quality gates

実装 Issue の Done 条件として、変更内容に応じて以下を通す。

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Critical flow を変更する場合:

```text
pnpm test:e2e
```

## Required critical E2E

通常の automated E2E は Google のログイン画面を経由せず、local Supabase Auth の test user / session を使う。

### Current scaffold

1. anonymous visitor → `/login`
2. OAuth callback error を provider detail なしで表示する
3. local Auth session fixture → protected `/`（`E2E_AUTH_ENABLED=1`）

### After letter feature implementation

1. authenticated local session → draft 作成 → 手紙送信
2. sealed letter 到着 → 開封 → 本文表示
3. 開封済み letter → 返信 → 返信を未来へ送信

## Google OAuth smoke test

Google OAuth 自体は critical E2E と分離し、少数の smoke test（`e2e/google-oauth.smoke.spec.ts`）で以下を確認する。CI では credential がないため skip する。

1. Google OAuth 開始
2. Supabase local / production Auth callback 成功
3. React `/auth/callback` へ復帰
4. Supabase session が生成・復元される
5. auth-required route へ遷移できる

外部 Google UI、CAPTCHA、MFA、bot detection、provider 側 UI 変更を通常 E2E の安定性へ持ち込まない。

## React / UI

React component を変更する場合、必要に応じて React Testing Library で user-observable behavior を検証する。

- implementation detail や内部 hook 呼び出し回数に過度に依存しない
- loading / error / empty / success state を必要な範囲で検証する
- TanStack Query を使う component は test 用 QueryClient を分離し、test 間で cache を共有しない
- auth-required UI は local / mocked session で認証状態を制御する

## GitHub Actions

`.github/workflows/ci.yml` は pull request と `main` への push で、Node.js 24 / pnpm lockfile を使って標準 quality gate と Playwright の基本 E2E を実行する。pnpm の依存ストアと Playwright Chromium はキャッシュし、lockfile が変わらない限り再ダウンロードを省略する。

React migration 完了後、CI の typecheck / component test は `tsc` / React Testing Library 前提である。

## DB / RLS

migration を変更する場合は少なくとも以下を検証する。

- cross-user access denial
- sealed body visibility
- sent content immutability
- service-role-only RPC denial
- exact scheduled time non-exposure

local verification:

```text
pnpm db:start
pnpm db:reset
pnpm db:lint
pnpm db:advisors
pnpm db:test
pnpm db:types
```

local stack では PostgreSQL だけでなく Auth (GoTrue) も起動し、auth / RLS integration test が可能な状態を維持する。

CI の `Database security gates` job は同じ migration reset / pgTAP を再実行し、generated DB types の drift も検知する。

## Design

画面変更では mobile viewport を第一基準とし、`docs/design/re-me-mobile-flow.jpg` と UX doc の意図に照らして確認する。

Mantine の default appearance に寄せるために mockup の世界観を崩さない。Re:Me theme / design tokens を優先しつつ、Mantine が提供する keyboard / focus / accessibility behavior は維持する。
