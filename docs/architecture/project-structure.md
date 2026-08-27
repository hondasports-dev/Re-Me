# プロジェクト構成

## Goal

Frontend は feature-first、backend は Convex function boundary で整理する。Cloudflare Worker を第二の application backend にしない。

## Target structure

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
│   └── lib/
│       ├── auth.ts
│       ├── authorization.ts
│       └── errors.ts
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

## App providers

`src/app/providers.tsx` に application-wide provider を集約する。

- MantineProvider
- Auth0Provider
- ConvexProviderWithAuth0
- React Router

Auth0 は login / logout / profile、Convex auth は backend request readiness を担当する。

## Frontend feature layout

```text
src/features/compose/
├── components/
├── hooks/
│   ├── useDraftLetter.ts
│   └── useSaveDraft.ts
├── model/
└── pages/
```

- feature 内だけの code は feature 内に置く
- Convex generated API を component に大量に直書きせず、意味のある feature hook で包む
- Convex data を TanStack Query や global store に複製しない
- form / modal / animation state は React state / context に置く
- authorization logic を frontend hook に置かない

## Convex backend layout

- `schema.ts`: tables、validators、indexes の正本
- `auth.config.ts`: Auth0 issuer / application id
- `letters.ts`: browser-facing query / mutation
- `delivery.ts`: exact schedule と internal delivery transition
- `notifications.ts`: outbox、action、retry
- `attachments.ts`: private R2 upload / download authorization
- `lib/authorization.ts`: current user と ownership を注入する shared wrapper

public function は React が直接必要なものだけにする。Cron / scheduler callback、delivery、notification completion は internal function にする。

## Route design

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

auth-required route は `useConvexAuth()` の loading / authenticated state を扱う。ただし router guard は UX 用で、データアクセスは Convex function の authorization が正本である。

## Cloudflare boundary

`worker/` は SPA hosting に必要な最小 entry point のみとする。business API、R2 authorization、delivery cron、notification state machine を Worker に置かない。

edge 固有 route を将来追加する場合は、Convex と責務が重複しないこと、Auth0 token validation、retry / rollback を ADR で先に定義する。

## Legacy migration boundary

`supabase/migrations/` は production data migration まで残す legacy artifact である。runtime の Supabase client / Hono application API / TanStack Query は置かない。

## Testing placement

- pure / React: feature 近傍または `tests/unit/`
- Convex schema / functions / authorization: `tests/convex/`
- Cloudflare asset / Worker behavior: `tests/worker/`
- critical user journeys: `e2e/`

Google OAuth UI を通常 E2E に含めず、Auth0 database test identity の `storageState` と少数の Google OAuth connection smoke を分離する。
