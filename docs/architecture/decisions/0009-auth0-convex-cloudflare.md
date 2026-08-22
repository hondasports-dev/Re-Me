# ADR-0009: Auth0 + Convex + Cloudflare をアプリ基盤にする

- Status: Accepted
- Date: 2026-08-22
- Supersedes: [ADR-0001](0001-cloudflare-supabase.md)
- Amends: [ADR-0006](0006-private-exact-delivery-time.md), [ADR-0007](0007-react-frontend-toolchain.md)

## Context

Re:Me は数日後から数年後まで手紙を保持し、本人であっても到着・開封前の sealed content と正確な到着日時を通常 client へ返さない必要がある。

従来は Supabase Auth / PostgreSQL + RLS、Cloudflare Worker / Cron / R2 を組み合わせていた。しかし、日常開発と Production を分離しながら無料枠で試しやすくし、認証・リアルタイムデータ・長期 scheduling の責務を明確にするため、基盤を再評価した。

## Decision

責務を以下に固定する。

- **Auth0**: Google OAuth connection、Universal Login、session / token issuance、account security
- **Convex**: application database、authorization、queries / mutations / actions、realtime、scheduled functions / cron、notification outbox
- **Cloudflare Workers Static Assets**: React SPA / PWA の配信、custom domain、CDN / edge protection
- **Cloudflare R2**: private photo object storage。`@convex-dev/r2` を介し、metadata と認可判断は Convex を正とする

Cloudflare Worker に汎用 application API を重複実装しない。Hono は target stack から外し、将来 edge 固有 endpoint が必要になった場合だけ別 ADR で再導入する。

TanStack Query は Convex data の標準層にしない。Convex の reactive query / mutation を利用し、別の remote API が実際に必要になるまで追加の server-state cache を持たない。

## Security boundaries

- Auth0 は authentication の source of truth だが、各操作の authorization は Convex function で必ず行う
- public Convex function は最小化し、ログイン必須 function は `ctx.auth.getUserIdentity()` と internal user ownership を検証する
- Auth0 の `sub` / `tokenIdentifier` を domain row の owner id として直接ばら撒かず、Convex の internal `users._id` に解決する
- sealed content、attachment、exact `scheduledAt` は許可された function の返却値にだけ含める
- client から任意の owner id、delivery state、exact schedule を信用しない
- R2 object は public にせず、短命 download URL または認可済み download flow を使う

## Delivery model

`sendLetter` mutation は ownership と draft state を検証し、delivery window 内の exact `scheduledAt` を一度だけ決定して保存する。exact value は client query の返却型から除外する。

配送は Convex cron が indexed due records を bounded batch で処理する。到着状態と notification delivery は同一状態にせず、outbox と action に分離する。外部 Web Push は at-most-once action の失敗を前提に、明示的な retry state と idempotency key を持つ。

## Environments

- Local / developer: Auth0 DEV tenant/application、Convex developer deployment、local Vite / Cloudflare Worker runtime
- Preview: Auth0 DEV tenant の preview callback、Convex preview deployment、Cloudflare preview URL
- Production: Auth0 PROD tenant/application、Convex production deployment、Cloudflare production Worker/custom domain

DEV と PROD では Auth0 tenant/application、Google OAuth client、Convex deployment、Cloudflare environment、secret を共有しない。

Auth0 custom domain は local / DEV の必須条件にしない。Production で issuer を custom domain に切り替える場合は callback、Convex `auth.config.ts`、既存 session への影響を含む別の cutover task とする。

## Consequences

### Positive

- RLS / RPC / Worker API に分散していた認可と state transition を Convex functions に集約できる
- realtime query、transactional mutation、scheduler を一つの backend model で扱える
- Auth0 の成熟した login / recovery / MFA 拡張余地を利用できる
- Cloudflare は hosting と private object storage に集中できる

### Trade-offs

- Auth0、Convex、Cloudflare の三サービスを運用する
- RLS の defense-in-depth はなくなるため、全 public function の authorization test が必須になる
- R2 integration は Convex と Cloudflare の二サービス境界になる
- vendor 間障害、quota、billing、backup / export、長期データ保持を本番前に検証する必要がある
- 既存 Supabase schema / auth code は target architecture と互換でなく、段階的な移行実装が必要になる

## Migration boundary

この ADR は target architecture を確定する。既存コードやデータの移行を同時に完了したことは意味しない。

移行は少なくとも以下を別 Issue で行う。

1. Auth0 DEV / PROD と Google OAuth connections の構成
2. Convex schema / indexes / auth config / authorization helpers
3. Supabase session provider から Auth0 + `ConvexProviderWithAuth0` への移行
4. Supabase tables / RPC / RLS test から Convex functions / authorization test への移行
5. Cloudflare Cron / Worker delivery から Convex cron / scheduled functions への移行
6. R2 access を Convex-authorized flow へ移行
7. production data inventory、export/import、rollback rehearsal
8. Supabase dependencies / migrations / secrets の撤去

Production data の存在と移行方式は実装前に確認し、存在する場合は Human Gate を通す。

## References

- [Convex & Auth0](https://docs.convex.dev/auth/auth0)
- [Convex authorization overview](https://docs.convex.dev/auth/overview)
- [Convex scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions)
- [Convex cron jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [Convex file storage security model](https://docs.convex.dev/file-storage/overview)
- [Convex Cloudflare R2 component](https://www.convex.dev/components/cloudflare-r2)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Auth0 React SPA quickstart](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 Google OAuth connection](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google)
