# プロジェクト構成

## 目的

Frontend は feature-first、backend は Convex function の境界で整理する。Cloudflare Worker を第二の application backend にしない。

## 目標構成

```text
.
├── AGENTS.md
├── README.md
├── convex/
│   ├── _generated/
│   ├── auth.config.ts
│   ├── schema.ts
│   ├── crons.ts
│   ├── users.ts
│   ├── letters.ts
│   ├── attachments.ts
│   ├── delivery.ts
│   ├── notifications.ts
│   ├── notificationActions.ts
│   └── lib/
│       ├── auth.ts
│       ├── authorization.ts
│       ├── deliverLetters.ts
│       └── notificationPolicy.ts
├── docs/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── providers.tsx
│   ├── router/
│   ├── features/
│   │   ├── auth/
│   │   ├── compose/
│   │   ├── traveling/
│   │   ├── inbox/
│   │   ├── letter/
│   │   ├── thread/
│   │   └── settings/
│   ├── shared/
│   │   ├── convex/
│   │   │   └── client.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── styles/
├── tests/
│   ├── unit/
│   └── convex/
├── e2e/
├── vite.config.ts
├── wrangler.jsonc
├── convex.json
├── package.json
└── pnpm-lock.yaml
```

## アプリの provider

`src/app/providers.tsx` にアプリ全体の provider を集約する。

- MantineProvider
- Auth0Provider
- ConvexProviderWithAuth0
- React Router

Auth0 は login / logout / プロフィール、Convex auth は backend リクエストの準備完了を担当する。

## フロントエンド feature の置き方

```text
src/features/compose/
├── components/
├── hooks/
│   ├── useDraftLetter.ts
│   └── useSaveDraft.ts
├── model/
└── pages/
```

- feature 内だけのコードは feature 内に置く
- Convex generated API を component に大量に直書きせず、意味のある feature hook で包む
- Convex data を TanStack Query や global store に複製しない
- フォーム / モーダル / アニメーション状態は React state / context に置く
- 認可ロジックを frontend hook に置かない

## Convex backend の置き方

- `schema.ts`: tables、validators、indexes の正本
- `auth.config.ts`: Auth0 issuer / application id
- `letters.ts`: ブラウザ向け query / mutation
- `delivery.ts`: 正確な配送時刻と internal な配送遷移
- `notifications.ts`: outbox の claim / 完了 / retry
- `notificationActions.ts`: Web Push 送信（`use node`、internal のみ）
- `attachments.ts`: 非公開 R2 の upload / download 認可
- `lib/authorization.ts`: 現在ユーザーと所有権を注入する共有 wrapper

public function は React が直接必要なものだけにする。Cron / scheduler callback、配送、通知完了は internal function にする。

## ルート設計

```text
/                       -> 届いた手紙
/login                  -> ログイン
/write                  -> 手紙を書く
/write/:letterId         -> 下書き編集
/write/:letterId/send    -> 未来へ送る前の確認
/traveling               -> 未来を旅する手紙
/traveling/:letterId     -> 旅の途中の手紙（読み返し / 削除）
/letters/:letterId       -> 開封前 / 本文
/letters/:letterId/reply -> 返信を書く
/threads/:threadId       -> 時間をまたぐスレッド
/settings                -> 設定
/auth/callback           -> OAuth callback
```

認証が必要なルートは `useConvexAuth()` の loading / authenticated 状態を扱う。ただし router ガードは UX 用で、データアクセスは Convex function の認可が正本である。

## Cloudflare の境界

`worker/` は SPA hosting に必要な最小の入口だけにする。業務 API、R2 認可、配送 cron、通知の状態機械を Worker に置かない。

将来 edge 固有の route を足す場合は、Convex と責務が重複しないこと、Auth0 token 検証、retry / rollback を ADR で先に定義する。

## legacy 移行の境界

`supabase/migrations/` は production data の移行まで残す legacy 成果物である。runtime の Supabase client / Hono application API / TanStack Query は置かない。

## テストの置き場

- 純粋関数 / React: feature の近く、または `tests/unit/`
- Convex schema / functions / 認可: `tests/convex/`
- Cloudflare asset / Worker の振る舞い: `tests/worker/`
- 重要なユーザー操作: `e2e/`

Google OAuth UI を通常 E2E に含めず、Auth0 database test identity の `storageState` と少数の Google OAuth connection smoke を分ける。
