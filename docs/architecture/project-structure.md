# プロジェクト構成

Frontend は feature-first、backend は Cloudflare Worker の domain 境界で整理する。
同じ責務を別の server runtime に複製しない。

```text
.
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── providers.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── compose/
│   │   ├── inbox/
│   │   ├── letters/
│   │   ├── settings/
│   │   └── traveling/
│   ├── shared/
│   │   ├── api/
│   │   ├── config/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── styles/
├── worker/
│   ├── app.ts
│   ├── index.ts
│   ├── db.ts
│   ├── domain.ts
│   ├── capability.ts
│   ├── photo.ts
│   ├── notification.ts
│   ├── auth.ts
│   └── ...
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_allow_draft_delivery_settings.sql
│   └── 0003_remove_legacy_import_bookkeeping.sql
├── tests/
│   ├── unit/
│   └── worker/
├── e2e/
├── vite.config.ts
├── wrangler.jsonc
├── package.json
└── pnpm-lock.yaml
```

## アプリの provider

`src/app/providers.tsx` に全体の provider を集約する。

- `QueryClientProvider`
- `MantineProvider`
- `ApiClientProvider`
- `Auth0Provider`
- `LiveAuthRuntimeProvider`
- React Router

Auth0 runtime は access token を API client へ渡し、feature hook は API response を
TanStack Query で扱う。認可ロジックを frontend に置かない。

## Feature の置き方

```text
src/features/compose/
├── components/
├── hooks/
├── model/
└── pages/
```

- feature 内だけの code は feature 内に置く
- API 呼び出しは feature hook / `src/shared/api` で包む
- server state を global store へ複製しない
- form、modal、animation state は React state / context に置く
- user-visible な画面・遷移には対応する Playwright を追加する

## Worker の置き方

- `app.ts`: Hono route、error / CORS、health
- `auth.ts`: Auth0 JWT 検証と D1 user 解決
- `db.ts`: D1 row 型、query、projection
- `domain.ts`: draft / send / open / delete / reply / delivery / notification の状態遷移
- `capability.ts`: 短命な R2 capability
- `photo.ts`: JPEG、metadata、サイズの server-side 検証
- `notification.ts`: payload、retry、endpoint policy
- `index.ts`: fetch、scheduled handler、Queue consumer

Worker の public route は必要最小限にし、generic な database patch route やブラウザ
からの D1 / R2 直接アクセスを置かない。

## ルート設計

```text
/                         -> 届いた手紙
/login                    -> ログイン
/write/:letterId          -> 手紙を書く
/write/:letterId/send    -> 未来へ送る確認
/traveling                -> 未来を旅する手紙
/traveling/:letterId     -> 旅の途中の手紙
/letters/:letterId       -> 開封前 / 本文
/letters/:letterId/reply -> 返信を書く
/threads/:threadId       -> 時間をまたぐスレッド
/settings                -> 設定
/auth/callback            -> OAuth callback
```

Router は UX の入口制御に留め、データアクセスは Worker API が認証・所有権・状態を
強制する。

## D1 と legacy artifact

`migrations/*.sql` が D1 schema の source of truth や。既存 migration は書き換えず、
変更は番号付き migration を追加する。`supabase/migrations/` は過去 schema の比較・
履歴確認用で、runtime の client や Worker path ではない。

## テストの置き場

- 純粋関数 / React: feature の近く、または `tests/unit/`
- Worker / D1 / R2 / Queue の振る舞い: `tests/worker/`
- CI、deploy 境界、environment 文書: `tests/unit/`
- 重要なユーザー操作: `e2e/`

通常 E2E は Auth0 database test identity の storage state を使い、Google OAuth UI は
少数の smoke test に分ける。
