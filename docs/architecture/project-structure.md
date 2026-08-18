# プロジェクト構成

## Goal

Re:Me は機能単位で変更範囲を閉じ込める。`components/` に何でも集める構成は避け、画面・use case・API を feature ごとにまとめる。

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
│   │   ├── App.vue
│   │   ├── main.ts
│   │   └── providers.ts
│   ├── router/
│   │   ├── index.ts
│   │   └── guards.ts
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
│   │   ├── components/
│   │   ├── composables/
│   │   ├── types/
│   │   └── utils/
│   └── styles/
│       ├── tokens.css
│       ├── base.css
│       ├── motion.css
│       └── primevue.ts
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

## Frontend feature layout

各 feature は必要なものだけを持つ。

```text
src/features/compose/
├── components/
│   ├── LetterEditor.vue
│   ├── DeliveryWindowPicker.vue
│   └── SealChoice.vue
├── composables/
│   └── useDraftLetter.ts
├── api/
│   └── compose.repository.ts
├── model/
│   ├── compose.schema.ts
│   └── compose.types.ts
└── views/
    ├── ComposeView.vue
    └── SendConfirmView.vue
```

ルール:

- feature 内だけで使うものは feature 外へ出さない。
- 2 つ以上の feature から使うものだけ `shared/` へ昇格する。
- `shared/components` を巨大な UI 部品置き場にしない。
- Supabase query を Vue component へ直接大量に書かない。repository / composable に隔離する。

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

### PrimeVue

入力・選択・モーダルなど、操作部品の品質と accessibility を担う。

### Re:Me custom UI

手紙・封筒・到着演出・時間軸など、ブランド体験を担う。

```text
src/styles/tokens.css
  ↓
PrimeVue custom preset
  +
Re:Me custom components
```

色・radius・shadow・spacing・motion duration を feature component に直接ばら撒かず token 化する。

## Testing placement

- pure function: 対象ファイルの近くに `*.test.ts` でもよい
- shared integration: `tests/unit/`
- Worker / scheduled: `tests/worker/`
- user journey: `e2e/`

E2E は全機能を網羅せず、以下の critical path を優先する。

1. Login → 手紙を書く → 送信
2. sealed letter 到着 → 開封
3. 開封 → 返信 → 再送信
