# 初期 Issue 草案

## Auth0 + Convex の土台

- Auth0Provider + ConvexProviderWithAuth0
- `convex/auth.config.ts`
- local / preview / production の環境契約
- Cloudflare Workers Static Assets の SPA hosting
- Supabase / Hono / TanStack Query は移行完了まで legacy と明示する

## Convex schema / 認可

- users、settings、threads、letters、contents、attachments、deliveries、notification jobs、push subscriptions
- 必須 indexes / pagination
- 認証済み wrapper / 所有権チェック
- args / return validator
- 他ユーザー / 封をした本文 / 正確な配送時刻のテスト

## 認証

- Auth0 Google OAuth の DEV connection
- login / logout / callback
- `useConvexAuth()` を基準にしたルートガード
- 通常 E2E と Google OAuth smoke の分離
- DEV / PROD の tenant / OAuth client 分離

## legacy Supabase の撤去

- Supabase session provider / client / generated DB types を Convex に置き換える
- local Supabase の script / 依存 / env を撤去する
- Hono application API と TanStack Query cache を撤去する
- migration / tests は Convex の coverage が通るまで残す
- production data の棚卸しと rollback 判断を記録する

## 作成 / 下書き

Convex query / mutation で白紙の手紙エディタ、自動保存、配送レンジ、封の選択を実装する。

## private R2 写真

Convex 認可つき upload / download、非公開 bucket、短命な権限、metadata 検証、EXIF 除去、削除の復旧を実装する。

## 送信 / 編集不可

`sendLetter` mutation が所有権、下書き、本文、配送レンジ、正確な配送時刻、返信の不変条件を同一 transaction で強制する。

## 配送 / 通知

Convex cron + due index + internal mutation + 通知 outbox + Web Push action + generation token 付き retry を実装する。

## 受信箱 / 開封 / 返信

封をした本文の可視性、`openLetter`、一本道の返信、未来への再送を実装する。

## CI / E2E

- Convex schema の push / typecheck
- 認可 / 状態遷移テスト
- React Testing Library
- Cloudflare SPA build
- Playwright の重要フロー
- Auth0 Google OAuth smoke は通常 E2E と分離する
