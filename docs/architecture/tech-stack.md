# 技術スタック

## Decision

Re:Me の MVP は、モバイルファースト Web App / PWA として以下の構成を採用する。

| Layer | Technology | 方針 |
|---|---|---|
| Runtime / CI | Node.js 24 LTS | 開発・CI の基準ランタイム |
| Package manager | pnpm | lockfile を必ずコミットする |
| Frontend | React + TypeScript | function component / hooks を標準とする |
| Build | Vite | SPA と Worker を同一 Vite 開発体験へ寄せる |
| Cloudflare integration | `@cloudflare/vite-plugin` + Wrangler | Workers runtime と本番環境の差を減らす |
| Routing | React Router | route / navigation / auth-required route の UX 制御 |
| Server state | TanStack Query | Supabase / Worker の query・mutation・cache invalidation を管理 |
| UI framework | Mantine | 操作 UI と accessibility の基盤。Re:Me theme を適用する |
| Worker API | Hono | `/api/*` と scheduled handler を整理する |
| Auth | Supabase Auth | MVP は Google OAuth を第一候補とする |
| Database | Supabase PostgreSQL | RLS を必須とする |
| File storage | Cloudflare R2 | 写真本体を保存する |
| Lint | Oxlint | ESLint は原則導入しない |
| Format | Oxfmt | Prettier は原則導入しない |
| Type check | `tsc --noEmit` | Vite/Oxc とは役割を分離する |
| Unit / component test | Vitest + React Testing Library | React component と純粋ロジック |
| Worker test | Vitest + Cloudflare Workers pool | workerd 上の Worker 挙動を検証する |
| E2E | Playwright | 重要なユーザーフローのみ |

## Frontend architecture

```text
React
├─ React Router        route / navigation
├─ TanStack Query      server state
├─ Supabase client     auth / RLS-protected DB access
├─ Mantine             operation UI / accessibility
└─ Re:Me custom UI     letter / envelope / time experience
```

### React

React component は表示と user interaction に集中させる。

- Supabase query を component 内へ大量に直書きしない
- Worker request を component 内へ散在させない
- domain logic は pure function / use case へ分離する
- reusable server-state access は TanStack Query hook と repository に寄せる

### React Router

React Router は URL と画面遷移を管理する。

- auth-required route の UX 上の redirect を担当する
- authorization の source of truth にはしない
- RLS / trusted RPC / Worker authorization を必ず併用する

### TanStack Query

TanStack Query は **server state 専用**とする。

対象:

- Supabase から取得する letter / thread / settings 等
- Worker API から取得する upload state 等
- mutation 成功後の query invalidation / refetch
- loading / error / retry state

対象外:

- Supabase Auth session の source of truth
- component 内で完結する form state
- modal open/close などの ephemeral UI state

同じ server state を Redux / Zustand 等へ二重保持しない。必要になるまで global state library は導入しない。

## UI framework: Mantine を選ぶ理由

画面リファレンスは Material Design のような強い既定スタイルではなく、淡い青、余白、ガラス感、封筒・手紙の演出を中心にしている。

Mantine は React 向けの操作 component、hooks、theme API、accessibility の基盤をまとめて提供しつつ、ブランド表現は theme / styles / custom component 側へ寄せやすい。

### Mantine に任せる

- Button
- Modal / Drawer
- TextInput / Textarea
- Select
- Switch / Checkbox
- Tabs
- Notification
- Skeleton / loading UI
- AppShell の基本 layout primitives

### Re:Me 専用コンポーネントとして作る

- 手紙本文 / 便箋
- 封筒 / 封印 UI
- 到着前の開封画面
- 未来を旅する手紙カード
- 時間をまたぐスレッド
- ランディング背景・演出

Mantine の default appearance をそのまま完成デザインとして採用しない。`src/styles/tokens.css` と `src/styles/theme.ts` を中心に Re:Me theme を定義する。

## State management

MVP では Redux / Zustand を最初から導入しない。

- Auth session: Supabase Auth + application provider
- Server state: TanStack Query
- Form state: component local state / hooks
- Global UI state: 必要最小限の React context

複数機能にまたがる client-only state が複雑化した時点で、専用 state library の導入を ADR / Issue で判断する。

## Oxc / TypeScript toolchain

標準 scripts の想定:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "lint": "oxlint .",
    "lint:fix": "oxlint . --fix",
    "format": "oxfmt .",
    "format:check": "oxfmt . --check",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

Oxc は lint / format を担当する。TypeScript の型検査は `tsc` を別ゲートとして実行する。

## Cloudflare application shape

Cloudflare Pages ではなく Worker をアプリのデプロイ単位とし、Vite plugin で静的 SPA と Worker API をまとめる。

Worker は Hono の `fetch` と Cloudflare の `scheduled` handler を一つの entry point から export する。

```text
Browser
  ├─ static React app ────────> Cloudflare Worker / Assets
  ├─ RLS-protected CRUD ──────> Supabase
  └─ privileged API ──────────> Hono on Worker
                                  ├─ R2
                                  └─ Supabase service role

Cloudflare Cron
  └───────────────────────────> scheduled handler
                                  └─ delivery / notification jobs
```

TanStack Query は Browser 側の server-state 管理層であり、Cloudflare / Supabase の trust boundary は変更しない。

## Local / Production environments

### Local / DEV

- Vite React dev server
- local Cloudflare Worker / workerd
- Supabase CLI local PostgreSQL
- Supabase CLI local Auth (GoTrue)
- local Google OAuth client は OAuth smoke test 時のみ利用

### Production

- Cloudflare Worker + static assets
- Supabase Cloud
- production Google OAuth client

クラウド上の Supabase DEV project は MVP の必須要件にしない。schema / RLS は migrations と local tests を source of truth とする。

## Dependency policy

- UI ライブラリで Re:Me のブランド表現を妥協しない。
- 同じ責務のライブラリを二重導入しない。
- formatter は Oxfmt、linter は Oxlint に一本化する。
- server state は TanStack Query に寄せ、別 store に複製しない。
- npm / yarn lockfile を作らない。`pnpm-lock.yaml` のみを正とする。
- major version は実装開始時の stable を lockfile で固定し、ドキュメントには不要に細かいバージョンを埋め込まない。
