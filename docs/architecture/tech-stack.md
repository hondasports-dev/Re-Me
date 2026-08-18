# 技術スタック

## Decision

Re:Me の MVP は、モバイルファースト Web App / PWA として以下の構成を採用する。

| Layer | Technology | 方針 |
|---|---|---|
| Runtime / CI | Node.js 24 LTS | 開発・CI の基準ランタイム |
| Package manager | pnpm | lockfile を必ずコミットする |
| Frontend | Vue 3 + TypeScript | Composition API + `<script setup lang="ts">` を標準とする |
| Build | Vite | SPA と Worker を同一 Vite 開発体験へ寄せる |
| Cloudflare integration | `@cloudflare/vite-plugin` + Wrangler | Workers runtime と本番環境の差を減らす |
| Routing | Vue Router | 認証ガードを含むクライアントルーティング |
| UI framework | PrimeVue + `@primeuix/themes` | Aura を土台に Re:Me 専用 design tokens を定義する |
| Worker API | Hono | `/api/*` と scheduled handler を整理する |
| Auth | Supabase Auth | MVP は Google OAuth を第一候補とする |
| Database | Supabase PostgreSQL | RLS を必須とする |
| File storage | Cloudflare R2 | 写真本体を保存する |
| Lint | Oxlint | ESLint は原則導入しない |
| Format | Oxfmt | Prettier は原則導入しない |
| Type check | `vue-tsc --noEmit` | Vite/Oxc とは役割を分離する |
| Unit / component test | Vitest + Vue Test Utils | Vue コンポーネントと純粋ロジック |
| Worker test | Vitest + Cloudflare Workers pool | workerd 上の Worker 挙動を検証する |
| E2E | Playwright | 重要なユーザーフローのみ |

## UI framework: PrimeVue を選ぶ理由

画面リファレンスは Material Design のような強い既定スタイルではなく、淡い青、余白、ガラス感、封筒・手紙の演出を中心にしている。

PrimeVue はコンポーネントを個別 import でき、design token ベースのテーマ調整がしやすいため、以下の使い分けとする。

### PrimeVue に任せる

- Button
- Dialog / Drawer
- Input / Textarea
- Toast
- Tabs
- Select
- Toggle / Checkbox
- Skeleton
- Progress / loading UI

### Re:Me 専用コンポーネントとして作る

- 手紙本文 / 便箋
- 封筒 / 封印 UI
- 到着前の開封画面
- 未来を旅する手紙カード
- 時間をまたぐスレッド
- ランディング背景・演出

PrimeVue の見た目をそのまま採用するのではなく、`src/styles/tokens.css` と専用 preset で画面リファレンスへ合わせる。

## State management

MVP では Pinia を最初から導入しない。

- Auth session: Supabase client
- Server state: feature ごとの repository / composable
- Form state: component / composable local state
- Global UI state: 最小限の provide/inject または composable

複数画面で複雑なクライアント状態が発生した時点で Pinia を追加する。依存を先回りして増やさない。

## Oxc toolchain

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
    "typecheck": "vue-tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

Oxc は lint / format を担当する。Vue SFC を含む TypeScript の型検査は `vue-tsc` を別ゲートとして実行する。

## Cloudflare application shape

Cloudflare Pages ではなく Worker をアプリのデプロイ単位とし、Vite plugin で静的 SPA と Worker API をまとめる。

Worker は Hono の `fetch` と Cloudflare の `scheduled` handler を一つの entry point から export する。

```text
Browser
  ├─ static app ──────────────> Cloudflare Worker / Assets
  ├─ user CRUD ───────────────> Supabase (RLS)
  └─ privileged API ──────────> Hono on Worker
                                  ├─ R2
                                  └─ Supabase service role

Cloudflare Cron
  └───────────────────────────> scheduled handler
                                  └─ delivery / notification jobs
```

## Dependency policy

- UI ライブラリで Re:Me のブランド表現を妥協しない。
- 同じ責務のライブラリを二重導入しない。
- formatter は Oxfmt、linter は Oxlint に一本化する。
- npm / yarn lockfile を作らない。`pnpm-lock.yaml` のみを正とする。
- major version は実装開始時の stable を lockfile で固定し、ドキュメントには不要に細かいバージョンを埋め込まない。
