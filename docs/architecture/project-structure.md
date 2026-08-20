# プロジェクト構成

## Goal

Re:Me は機能単位で変更範囲を閉じ込める。`components/` に何でも集める構成は避け、画面・server state・use case・API を feature ごとにまとめる。

## Target structure

```text
.
├── AGENTS.md
├── README.md
├── docs/
│   ├── architecture/
│   ├── design/
│   ├── development/
│   └── product/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── providers.tsx
│   ├── router/
│   │   ├── index.tsx
│   │   └── RequireAuth.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── compose/
│   │   ├── traveling/
│   │   ├── inbox/
│   │   ├── letter/
│   │   ├── thread/
│   │   └── settings/
│   ├── shared/
│   │   ├── api/
│   │   │   ├── supabase.ts
│   │   │   └── worker.ts
│   │   ├── query/
│   │   │   └── client.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── styles/
│       ├── tokens.css
│       ├── theme.ts
│       ├── base.css
│       └── motion.css
├── worker/
│   ├── index.ts
│   ├── app.ts
│   ├── routes/
│   │   ├── attachments.ts
│   │   └── health.ts
│   ├── jobs/
│   │   ├── deliver-letters.ts
│   │   └── send-notifications.ts
│   └── lib/
│       ├── auth.ts
│       ├── supabase-admin.ts
│       └── errors.ts
├── supabase/
│   ├── migrations/
│   └── README.md
├── tests/
│   ├── unit/
│   └── worker/
├── e2e/
├── vite.config.ts
├── wrangler.jsonc
├── tsconfig.json
├── oxlint.json
├── .oxfmtrc.json
├── package.json
└── pnpm-lock.yaml
```

## App providers

`src/app/providers.tsx` では application-wide provider を集約する。

想定:

- MantineProvider
- QueryClientProvider
- Supabase Auth session provider
- 必要最小限の application context

provider の nest を feature component へ散らさない。

## Frontend feature layout

各 feature は必要なものだけを持つ。

```text
src/features/compose/
├── components/
│   ├── LetterEditor.tsx
│   ├── DeliveryWindowPicker.tsx
│   └── SealChoice.tsx
├── hooks/
│   ├── useDraftLetterQuery.ts
│   └── useSaveDraftMutation.ts
├── api/
│   └── compose.repository.ts
├── model/
│   ├── compose.schema.ts
│   └── compose.types.ts
└── pages/
    ├── ComposePage.tsx
    └── SendConfirmPage.tsx
```

ルール:

- feature 内だけで使うものは feature 外へ出さない。
- 2 つ以上の feature から使うものだけ `shared/` へ昇格する。
- `shared/components` を巨大な UI 部品置き場にしない。
- Supabase query / Worker request を React component へ直接大量に書かない。
- server state は repository + TanStack Query hook に隔離する。
- query key は feature 単位で一貫して定義し、mutation 後の invalidation 対象を明示する。
- form state や temporary UI state を TanStack Query cache に入れない。

## Route design

MVP の想定 route:

```text
/                       -> 届いた手紙
/login                  -> Login
/write                  -> 手紙を書く
/write/:letterId         -> 下書き編集
/write/:letterId/send    -> 未来へ送る前の確認
/traveling               -> 未来を旅する手紙
/letters/:letterId       -> 開封前 / 本文
/letters/:letterId/reply -> 返信を書く
/threads/:threadId       -> 時間をまたぐスレッド
/settings                -> 設定
/auth/callback           -> OAuth callback
```

`/`, `/write*`, `/traveling`, `/letters*`, `/threads*`, `/settings` は認証必須。

React Router の auth-required route は未認証 user を `/login` へ誘導する。ただし router guard は UX のための境界であり、データ認可は Supabase RLS / trusted RPC / Worker 側でも必ず強制する。

## Server-state boundary

TanStack Query を server state の標準アクセス層とする。

```text
React component
      ↓
feature query / mutation hook
      ↓
repository
      ├─ Supabase client
      └─ Worker API
```

責務:

- loading / error / retry
- cache
- mutation 後の invalidate / refetch
- server response の共有

TanStack Query cache を永続的な domain source of truth とみなさない。authorization は常に server / DB 側で判定する。

## Worker boundary

Browser から Supabase へ直接アクセスしてよい処理:

- 自分の metadata の SELECT
- RLS で許可された本文 SELECT
- draft 本文 autosave
- user settings
- push subscription の登録 / 削除

Worker / RPC に寄せる処理:

- draft 作成
- 未来へ送る
- 封印後の開封
- 送信済み手紙の削除
- 写真の R2 upload / delete
- delivery cron
- notification outbox

特に「送信」「開封」「配送」は UI の状態変更だけで成立させず、DB の trusted operation として実装する。

## Styling boundary

### Mantine

入力・選択・モーダル・通知・基本 layout など、操作部品の品質と accessibility を担う。

### Re:Me custom UI

手紙・封筒・到着演出・時間軸など、ブランド体験を担う。

```text
src/styles/tokens.css
  +
src/styles/theme.ts
  ↓
MantineProvider
  +
Re:Me custom components
```

色・radius・shadow・spacing・typography・motion duration を feature component に直接ばら撒かず token / theme 化する。

Mantine の default appearance を完成デザインとはみなさず、`docs/design/re-me-mobile-flow.jpg` の意図を優先する。

## Testing placement

- pure function: 対象ファイルの近くに `*.test.ts` でもよい
- React component: 対象 feature 近傍または `tests/unit/` に React Testing Library test
- shared integration: `tests/unit/`
- Worker / scheduled: `tests/worker/`
- user journey: `e2e/`

E2E は全機能を網羅せず、以下の critical path を優先する。

1. authenticated local session → 手紙を書く → 送信
2. sealed letter 到着 → 開封
3. 開封 → 返信 → 再送信

通常の E2E は Google のログイン UI を経由しない。Google OAuth の callback / session integration は別の smoke test として扱う。
