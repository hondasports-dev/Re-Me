# Initial issues draft

## Auth0 + Convex foundation

- Auth0Provider + ConvexProviderWithAuth0
- `convex/auth.config.ts`
- developer / preview / production environment contract
- Cloudflare Workers Static Assets の SPA hosting
- Supabase / Hono / TanStack Query は migration 完了まで legacy と明示

## Convex schema / authorization

- users、settings、threads、letters、contents、attachments、deliveries、notification jobs、push subscriptions
- required indexes / pagination
- authenticated wrappers / ownership checks
- args / return validators
- cross-user / sealed content / exact schedule tests

## Auth

- Auth0 Google OAuth DEV connection
- login / logout / callback
- `useConvexAuth()` based route guard
- normal E2E と Google OAuth smoke の分離
- DEV / PROD tenant / OAuth client separation

## Legacy Supabase removal

- Supabase session provider / client / generated DB types を Convex に置換
- local Supabase scripts / dependency / env を撤去
- Hono application API と TanStack Query cache を撤去
- migration / tests は Convex coverage が green になるまで残す
- production data inventory と rollback decision を記録

## Compose / Draft

Convex query / mutation で blank letter editor、autosave、delivery window、seal choice を実装する。

## Private R2 photo

Convex-authorized upload / download、private bucket、short-lived capability、metadata validation、EXIF stripping、delete reconciliation を実装する。

## Send / Immutability

`sendLetter` mutation が ownership、draft、content、delivery window、exact schedule、reply invariant を transactionally 強制する。

## Delivery / Notification

Convex cron + due index + internal mutation + notification outbox + Web Push action + generation-token retry を実装する。

## Inbox / Open / Reply

sealed content visibility、`openLetter`、一本道 reply invariant、future send を実装する。

## CI / E2E

- Convex schema push / typecheck
- authorization / state transition tests
- React Testing Library
- Cloudflare SPA build
- Playwright critical flow
- Auth0 Google OAuth smoke は通常 E2E と分離
