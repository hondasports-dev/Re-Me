# Re:Me

> **未来のあなたへ**

Re:Me は、今の自分から未来の自分へ手紙を送り、時間をまたいで自分自身と会話する
ための、モバイルファースト Web アプリや。

## コンセプト

- 今の気持ち・判断・迷い・出来事を、分類せず自由な手紙として残す
- 届ける時期はざっくり指定、または「未来に任せる」
- 手紙は「封をする / 封をしない」を選べる
- 送信後の内容は編集できないが、プライバシーのため削除はできる
- 到着した手紙へ返信し、その返信もさらに未来へ送る
- 返信を重ねて、数年単位の「自分との会話」を一本道のスレッドに育てる

## プロダクト原則

1. **時間そのものを体験にする**
2. **分類しない** — 日記・ToDo・判断ログの型を押し付けない
3. **送信した瞬間を固定する** — 送信後は編集不可。ただし安全のため削除は可能
4. **内容を不用意に露出しない** — 通知に本文・写真を出さない
5. **機能より余白を優先する** — Re:Me の世界観に寄与しない機能は増やさない
6. **モバイルファースト** — 「ふと残したい瞬間」と「突然届く瞬間」をスマートフォン中心に設計する

## 基本フロー

```text
手紙を書く
  ↓
届ける時期と封を選ぶ
  ↓
未来へ送る
  ↓
未来を旅する
  ↓
到着通知
  ↓
開封する
  ↓
読む
  ↓
返信を未来へ送る
```

## デザインリファレンス

実装時の主要な画面構成・遷移・トーン&マナーは、以下のモバイルファースト UI コンセプトを基準にするで。

![Re:Me モバイル画面遷移](docs/design/re-me-mobile-flow.jpg)

詳細は [デザインリファレンス](docs/design/README.md) と [UX / 画面遷移](docs/product/ux-flow.md) を参照してな。

## 技術スタック

- Node.js 24 LTS / pnpm
- React + TypeScript + Vite
- React Router / Mantine
- Auth0 + Google OAuth
- Cloudflare Workers Static Assets
- Cloudflare Worker + Hono API
- Cloudflare D1 / private R2 / Queues / Scheduled Worker
- HTTP API + TanStack Query
- Oxlint / Oxfmt / TypeScript
- Vitest + React Testing Library + Playwright

詳細は [技術スタック](docs/architecture/tech-stack.md) と
[アーキテクチャ概要](docs/architecture/overview.md) を参照してな。

## セキュリティ上の主要設計

- `letters` metadata と `letter_contents` 本文を分離する
- sealed letter は到着・明示的な開封まで Worker API が本文と添付を返さない
- exact `scheduledAt` は内部 D1 row にだけ置き、browser response / log に出さない
- 送信後編集不可を専用 Worker route、D1 transaction、trigger で強制する
- Delivery と Notification を D1 outbox で分離する
- Auth0 / Cloudflare の secret は browser bundle へ公開しない
- 写真本体は private R2 に置き、短命 capability と owner / state 検証を通す

## 環境方針

環境ごとに Auth0 と Cloudflare resource を分離する。

- **Local**: Auth0 DEV + local Worker / D1 / R2 / Queue
- **Preview / CI E2E**: Auth0 DEV の固定 callback + `re-me-preview` Worker / D1 / R2 /
  Queue
- **Production**: `re-me` の config はあるが、Auth0 PROD と Worker の初回 deploy は
  未実施

Preview の接続先・初回セットアップは
[Local / Preview 環境](docs/development/preview-environment.md) と
[開発セットアップ](docs/development/setup.md) を正とする。

通常の自動 E2E は Google OAuth UI に依存せず、Auth0 database test identity の
storage state を使う。Google OAuth の実連携は少数の smoke test で確認する。

## ドキュメント

### Product

- [プロダクトビジョン](docs/product/vision.md)
- [要件定義](docs/product/requirements.md)
- [UX / 画面遷移](docs/product/ux-flow.md)
- [MVP スコープ](docs/product/mvp.md)

### Architecture

- [アーキテクチャ概要](docs/architecture/overview.md)
- [技術スタック](docs/architecture/tech-stack.md)
- [プロジェクト構成](docs/architecture/project-structure.md)
- [データモデル](docs/architecture/data-model.md)
- [認証・セキュリティ](docs/architecture/auth-security.md)
- [手紙の配送・通知](docs/architecture/delivery-notifications.md)
- [ADR: Cloudflare-only Preview runtime](docs/architecture/decisions/0012-cloudflare-only-preview-runtime.md)
- [ADR: 送信後編集不可](docs/architecture/decisions/0002-immutable-letter.md)
- [ADR: ざっくり配送](docs/architecture/decisions/0003-delivery-window.md)
- [ADR: React / Vite / React Router](docs/architecture/decisions/0007-react-frontend-toolchain.md)
- [ADR: Mantine design system](docs/architecture/decisions/0008-mantine-design-system.md)
- [ADR: exact delivery time を private にする](docs/architecture/decisions/0006-private-exact-delivery-time.md)

### Implementation

- [開発セットアップ](docs/development/setup.md)
- [Local / Preview 環境](docs/development/preview-environment.md)
- [品質ゲート](docs/development/quality-gates.md)
- [本番準備](docs/development/production-readiness.md)
- [Production 環境](docs/development/production-environment.md)
- [Legacy data migration status](docs/development/legacy-migration.md)
- [移行前 Supabase baseline](supabase/README.md)
- [デザインリファレンス](docs/design/README.md)
- [開発ルール](AGENTS.md)

## ステータス

Preview の application runtime は Cloudflare Worker / D1 / R2 / Queue へ移行済み。
repository から旧 backend の source、client、scheduler、依存、CI job、migration CLI
は撤去した。Production はまだ未デプロイ・未投入で、Production data migration は
不要や。初回 Production 構築と traffic 切替は別 task と Human Gate で行う。
