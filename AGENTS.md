# AGENTS.md

## Project

- Product: **Re:Me**
- Subtitle: **未来のあなたへ**
- Product concept: 今の自分から未来の自分へ手紙を送り、時間をまたいで自分自身と会話する。
- Primary target: モバイルファースト Web App / PWA

## Core product rules

実装・設計判断で迷った場合は、以下を優先する。

1. 手紙は分類しない。カテゴリ・タグを前提にしない。
2. 送信後の本文・添付・配送設定は編集不可とする。
3. 削除は可能とする。誤送信・プライバシー上の救済を優先する。
4. 「封をする」手紙は、到着して明示的に開封するまで本人の通常 client から本文を取得できない。
5. 「封をしない」手紙は、送信後も読み返せるが編集できない。
6. 通知には本文・写真などの内容を表示しない。
7. 返信は現在に蓄積するだけではなく、再び未来へ送る。
8. 一つの手紙からの返信は一本道のスレッドを基本とし、枝分かれする会話構造は MVP では作らない。
9. 画面や機能を増やす前に「時間をまたいで自分と会話する体験」に必要か確認する。
10. デスクトップよりモバイル UX を優先する。

## Fixed implementation stack

- Node.js 24 LTS
- pnpm
- Vue 3 + TypeScript
- Vite
- Vue Router
- PrimeVue + `@primeuix/themes`
- Cloudflare Worker + `@cloudflare/vite-plugin`
- Hono for Worker routes
- Supabase Auth
- Supabase PostgreSQL + RLS
- Cloudflare R2
- Oxlint
- Oxfmt
- `vue-tsc`
- Vitest + Vue Test Utils
- Playwright for critical E2E

同じ責務の tool を重複導入しない。

- ESLint を追加しない。必要な rule が Oxlint で実現できない場合は先に ADR / issue で判断する。
- Prettier を追加しない。formatter は Oxfmt を正とする。
- npm / yarn lockfile を作らない。`pnpm-lock.yaml` のみコミットする。
- PrimeVue の default 見た目を完成デザインとして扱わない。`docs/design/re-me-mobile-flow.jpg` と design token を優先する。

## Project structure rules

feature-first を基本とする。

- Frontend feature: `src/features/<feature>/`
- Cross-feature code: `src/shared/`
- App bootstrap: `src/app/`
- Router: `src/router/`
- Cloudflare-only code: `worker/`
- DB migration: `supabase/migrations/`

feature 内だけで使う code を安易に `shared/` へ移動しない。

Vue component に Supabase query / Worker request / complex domain logic を直接大量に書かず、repository / composable / pure function へ分離する。

## Architecture rules

- Supabase PostgreSQL では RLS を必須とし、ユーザー境界を DB 側でも強制する。
- public `letters` は metadata、本文は `letter_contents` に分離する。
- sealed letter の本文 / attachment は RLS で到着・開封前の本人からも隠す。
- exact `scheduled_at` は public schema に置かず `private.letter_delivery` に置く。
- Service Role 相当の秘密情報をブラウザへ公開しない。
- 到着判定・配送状態遷移・通知送信は信頼できるサーバー側処理で行う。
- 重要な状態遷移は trusted RPC を使い、client の任意 UPDATE にしない。
- 写真は DB 本文に保存せず R2 へ保存する。
- 写真アップロード時は EXIF / 位置情報漏えいを考慮する。
- 日付・時刻は DB では UTC、UI ではユーザーのタイムゾーンに変換する。
- 配送処理は冪等にする。同じ job が複数回実行されても二重到着・二重通知を起こさない。
- Letter delivery と notification success を同じ状態として扱わない。outbox で分離する。

## DB change rules

- `supabase/migrations/` が schema / RLS の source of truth。
- 適用済み migration を後から書き換えず、変更は新しい migration を追加する。
- Dashboard の手作業だけで本番 schema を変更しない。
- RLS / grant / RPC / trigger の変更には access-control test を追加する。
- sent letter immutability を client 側 validation だけに依存しない。

## UI rules

- mobile viewport を最初に設計・検証する。
- 画面リファレンス: `docs/design/re-me-mobile-flow.jpg`
- PrimeVue は操作 component の基盤として使い、便箋・封筒・開封・時間軸は custom component とする。
- 色・shadow・radius・motion を component へ散在させず `src/styles/tokens.css` に寄せる。
- 通知や inbox preview に letter content を表示しない。
- accessibility を animation より優先し、`prefers-reduced-motion` を考慮する。

## Quality gates

変更内容に応じて以下を通す。

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

critical user flow を変更する場合は該当 Playwright E2E も実行する。

最低限の critical E2E:

1. Login → draft → send
2. sealed letter 到着 → open
3. open → reply → send to future

テストは実装詳細より user-observable behavior を優先する。

## Documentation rules

仕様を変える場合、コードだけを変更せず関連ドキュメントを更新する。

- Product concept / UX → `docs/product/`
- Architecture / data / security → `docs/architecture/`
- 重要な設計判断 → `docs/architecture/decisions/`
- DB → `supabase/migrations/` + 必要に応じて `supabase/README.md`

確定していない仕様を勝手に確定扱いしない。未決定事項は `TBD` または Open Question として明示する。
