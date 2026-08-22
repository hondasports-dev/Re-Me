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

These packages may remain temporarily during migration. Presence in `package.json` does not make them part of the target stack.

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
- upload 前に MIME、size、dimension を検証し、EXIF / location metadata を除去する
- download は authorization 後の短命 URL / capability とする
- sealed / unopened content の URL を client query に返さない

Convex File Storage の恒久 bearer URL は access condition が後から変わる sealed media と相性が悪いため、MVP photo は R2 integration を採用する。

## Environment policy

- Auth0: DEV tenant/application と PROD tenant/application を分離
- Google OAuth: DEV client と PROD client を分離
- Convex: developer / preview / production deployment を分離
- Cloudflare: preview / production environment を分離
- environment values は provider ごとに設定し、Git に secret を保存しない

## Migration note

Target stack への runtime migration は別 Issue で段階的に行う。移行完了までは legacy Supabase migration / tests を削除せず、同一 PR 内で新旧 backend を長期二重運用しない。
