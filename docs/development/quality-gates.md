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

1. Google Login → draft 作成 → 手紙送信
2. sealed letter 到着 → 開封 → 本文表示
3. 開封済み letter → 返信 → 返信を未来へ送信

## GitHub Actions

`.github/workflows/ci.yml` は pull request と `main` への push で、Node.js 24 / pnpm lockfile を使って標準 quality gate と Playwright の基本 E2E を実行する。pnpm の依存ストアと Playwright Chromium はキャッシュし、lockfile が変わらない限り再ダウンロードを省略する。

## DB / RLS

migration を変更する場合は少なくとも以下を検証する。

- cross-user access denial
- sealed body visibility
- sent content immutability
- service-role-only RPC denial
- exact scheduled time non-exposure

## Design

画面変更では mobile viewport を第一基準とし、`docs/design/re-me-mobile-flow.jpg` と UX doc の意図に照らして確認する。

PrimeVue の default appearance に寄せるために mockup の世界観を崩さない。
