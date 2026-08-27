# 技術スタック

## Target stack

| Layer | Technology | Responsibility |
|---|---|---|
| Runtime | Node.js 24 LTS | local tooling / CI |
| Package manager | pnpm | dependency / script management |
| Frontend | React + TypeScript + Vite | mobile-first SPA / PWA |
| Routing | React Router | URL / navigation / login UX |
| UI | Mantine + Re:Me design system | accessible primitives / brand UI |
| Authentication | Auth0 + Google OAuth | Universal Login、token / session |
| Backend | Convex | functions、database、realtime、scheduler |
| Client data | Convex React client | reactive query / transactional mutation |
| File storage | Cloudflare R2 via `@convex-dev/r2` | private photo objects |
| Hosting | Cloudflare Workers Static Assets | SPA / PWA、CDN、edge protection |
| Notifications | Web Push from Convex action | privacy-safe arrival notification |
| Toolchain | Oxlint + Oxfmt + `tsc --noEmit` | lint / format / typecheck |
| Tests | Vitest + React Testing Library + Playwright | unit / integration / E2E |

## Deliberately excluded by default

- Supabase Auth / PostgreSQL / RLS
- Hono application API
- Cloudflare Cron for letter delivery
- direct public R2 bucket access
- TanStack Query for Convex data
- Redux / Zustand before a demonstrated client-state need
- ESLint / Prettier alongside Oxc tools

Runtime から外した。`supabase` CLI は `supabase/migrations/` の比較用にだけ残す。

## Frontend providers

```text
MantineProvider
  └─ Auth0Provider
      └─ ConvexProviderWithAuth0
          └─ React Router
```

Use `useAuth0()` for login / logout / identity presentation and `useConvexAuth()` for whether authenticated Convex calls are ready. Do not treat route state or browser-provided user identifiers as authorization evidence.

## Convex function rules

- every registered function has args and return validators
- default to internal functions; expose only what React calls
- authenticated public functions resolve current user and enforce ownership
- every growing read path uses an index and bounded query / pagination
- state transitions are mutations, external side effects are actions
- exact schedule and sealed content are excluded from unauthorized return shapes
- schema and functions under `convex/` are the backend source of truth

## Server-state policy

Convex `useQuery` / `useMutation` / `useAction` is the standard data access path. Reactive queries already cache and update server state, so `useEffect` refetch loops and a second query cache are not introduced.

Form state、modal state、draft editor transient state は React state / context に置く。永続 draft は mutation で Convex へ保存する。

## Cloudflare policy

Workers Static Assets を React SPA の deployment unit とする。

- `assets.not_found_handling = "single-page-application"`
- hashed assets は Cloudflare cache を利用する
- secrets を browser bundle に含めない
- application API / database / scheduler は Convex に置く
- edge 固有 code が必要になるまで Worker entry point は最小化する

## R2 policy

- bucket は private
- object id / metadata / ownership は Convex document に保存する
- Local / developer と Preview は別 bucket・別 bucket-scoped credential を使う。Production は別 Issue とする
- upload 前に JPEG / PNG / WebP、10 MiB 以下を検証し、Canvas 再 encode 後の JPEG を長辺 4096 px、5 MiB 以下にする
- upload capability は5分、download capability は60秒とする
- upload URL は5分だけ有効な staging key、Content-Length、`If-None-Match: *`に限定し、同じ capability による上書きを拒否する。finalize 時の HEAD でも intent の byte size と5MB上限へ一致することを強制する。検証後は attempt ごとの一意な final key をcopy前に永続登録してETag条件付きcopyし、Convexのatomic winnerだけをattachmentへ確定する。非winnerは最大 action 時間を越える tombstone 期間中に再削除し、cronが削除成功まで追跡する
- finalize 時に MIME、size、dimension、EXIF / XMP / IPTC metadata 不在を server 側で再検証する
- CORS は既知の Local / Preview origin と `PUT, GET, HEAD`、`Content-Type`・`Content-Length`・`If-None-Match` header だけを許可する
- sealed / unopened content の URL を client query に返さない

Convex File Storage の恒久 bearer URL は access condition が後から変わる sealed media と相性が悪いため、MVP photo は R2 integration を採用する。

## Environment policy

- Auth0: DEV tenant/application と PROD tenant/application を分離
- Google OAuth: DEV client と PROD client を分離
- Convex: developer / preview / production deployment を分離
- Cloudflare: preview / production environment を分離
- environment values は provider ごとに設定し、Git に secret を保存しない

## Migration note

Runtime は Auth0 + Convex。`supabase/migrations/` は production data migration / rollback 方針が固まるまで invariant 比較用に残す。通常の `pnpm test` は local Supabase を起動しない。最終削除は別 Issue と Human Gate で行う。
