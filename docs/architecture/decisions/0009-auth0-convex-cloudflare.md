# ADR-0009: Auth0 + Convex + Cloudflare をアプリ基盤にする

- 状態: 採用
- 日付: 2026-08-22
- 改訂: 2026-08-29（JST）
- 置換対象: [ADR-0001](0001-cloudflare-supabase.md)
- 改訂対象: [ADR-0006](0006-private-exact-delivery-time.md), [ADR-0007](0007-react-frontend-toolchain.md)

## 背景

Re:Me は数日後から数年後まで手紙を保持し、本人であっても到着・開封前の封をした本文と正確な到着日時を通常の client へ返さない必要がある。

従来は Supabase Auth / PostgreSQL + RLS、Cloudflare Worker / Cron / R2 を組み合わせていた。しかし、日常開発と Production を分離しながら無料枠で試しやすくし、認証・リアルタイムデータ・長期 scheduling の責務を明確にするため、基盤を再評価した。

## 決定

責務を以下に固定する。

- **Auth0**: Google OAuth connection、Universal Login、session / token 発行、アカウントセキュリティ
- **Convex**: application database、認可、query / mutation / action、realtime、scheduled functions / cron、通知 outbox
- **Cloudflare Workers Static Assets**: React SPA / PWA の配信、custom domain、CDN / edge 保護
- **Cloudflare R2**: 非公開の写真 object storage。`@convex-dev/r2` を介し、metadata と認可判断は Convex を正とする

Cloudflare Worker に汎用 application API を重複実装しない。Hono は target stack から外し、将来 edge 固有 endpoint が必要になった場合だけ別 ADR で再導入する。

TanStack Query は Convex data の標準層にしない。Convex の reactive query / mutation を利用し、別の remote API が実際に必要になるまで追加の server-state cache を持たない。

## セキュリティ境界

- Auth0 は認証の正本だが、各操作の認可は Convex function で必ず行う
- public Convex function は最小化し、ログイン必須 function は `ctx.auth.getUserIdentity()` と内部ユーザーの所有権を検証する
- Auth0 の `sub` / `tokenIdentifier` をドメイン行の owner id として直接ばら撒かず、Convex の内部 `users._id` に解決する
- 封をした本文、添付、正確な `scheduledAt` は許可された function の返却値にだけ含める
- client から任意の owner id、配送状態、正確な配送時刻を信用しない
- R2 object は公開せず、短命な download URL または認可済み download 経路を使う

## 配送モデル

`sendLetter` mutation は所有権と下書き状態を検証し、配送レンジ内の正確な `scheduledAt` を一度だけ決定して保存する。正確な値は client query の返却型から除外する。

配送は Convex cron が期限到来レコードを index 経由で件数上限つきバッチ処理する。到着状態と通知配送は同一状態にせず、outbox と action に分離する。外部 Web Push は at-most-once action の失敗を前提に、明示的な retry 状態と冪等キーを持つ。

## 環境

- Local: Auth0 DEV tenant/application、Convex local backend、local Vite / Cloudflare Worker runtime。cloud developer deployment は日常開発の正本にしない。接続先は [Local / Preview 環境](../../development/preview-environment.md)
- Preview / CI E2E: Auth0 DEV tenant の preview callback、共有 Convex preview deployment、Cloudflare preview URL。CI Playwright は Preview へ deploy したあと remote 参照する
- Production: Auth0 PROD tenant/application、Convex production deployment、Cloudflare production Worker/custom domain

DEV と PROD では Auth0 tenant/application、Google OAuth client、Convex deployment、Cloudflare environment、secret を共有しない。

Auth0 custom domain は local / DEV の必須条件にしない。Production で issuer を custom domain に切り替える場合は callback、Convex `auth.config.ts`、既存 session への影響を含む別の切り替え task とする。

## 帰結

### 良い点

- RLS / RPC / Worker API に分散していた認可と状態遷移を Convex functions に集約できる
- realtime query、transactional mutation、scheduler を一つの backend モデルで扱える
- Auth0 の成熟した login / recovery / MFA 拡張余地を利用できる
- 日常の local 開発は Convex local backend を使い、cloud 無料枠を消費しない。CI E2E は共有 Preview の remote Convex に揃える

### トレードオフ

- Auth0、Convex、Cloudflare の三サービスを運用する
- RLS の多層防御はなくなるため、全 public function の認可テストが必須になる
- R2 integration は Convex と Cloudflare の二サービス境界になる
- 基盤障害、枠、課金、backup / export、長期データ保持を本番前に検証する必要がある
- 既存 Supabase schema / auth code は target architecture と互換でなく、段階的な移行実装が必要になる

## 移行の境界

この ADR は target architecture を確定する。既存コードやデータの移行を同時に完了したことは意味しない。

移行は少なくとも以下を別 Issue で行う。

1. Auth0 DEV / PROD と Google OAuth connections の構成
2. Convex schema / indexes / auth config / 認可 helper
3. Supabase session provider から Auth0 + `ConvexProviderWithAuth0` への移行
4. Supabase tables / RPC / RLS test から Convex functions / 認可テストへの移行
5. Cloudflare Cron / Worker 配送から Convex cron / scheduled functions への移行
6. R2 アクセスを Convex 認可フローへ移行
7. production data の棚卸し、export/import、rollback リハーサル
8. Supabase の依存 / migrations / secrets の撤去

Production data の存在と移行方式は実装前に確認し、存在する場合は Human Gate を通す。

## 参照

- [Convex & Auth0](https://docs.convex.dev/auth/auth0)
- [Convex authorization overview](https://docs.convex.dev/auth/overview)
- [Convex scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions)
- [Convex cron jobs](https://docs.convex.dev/scheduling/cron-jobs)
- [Convex file storage security model](https://docs.convex.dev/file-storage/overview)
- [Convex Cloudflare R2 component](https://www.convex.dev/components/cloudflare-r2)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Auth0 React SPA quickstart](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 Google OAuth connection](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google)
