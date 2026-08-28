# 技術スタック

## 採用するスタック

| 層 | 技術 | 責務 |
|---|---|---|
| Runtime | Node.js 24 LTS | ローカル tooling / CI |
| パッケージ管理 | pnpm | 依存関係 / script 管理 |
| フロントエンド | React + TypeScript + Vite | モバイルファースト SPA / PWA |
| ルーティング | React Router | URL / 画面遷移 / ログイン UX |
| UI | Mantine + Re:Me design system | 操作 UI のアクセシビリティ基盤 / ブランド UI |
| 認証 | Auth0 + Google OAuth | Universal Login、token / session |
| バックエンド | Convex | functions、database、realtime、scheduler |
| クライアントデータ | Convex React client | reactive query / transactional mutation |
| ファイル保存 | Cloudflare R2（`@convex-dev/r2`） | 非公開の写真オブジェクト |
| ホスティング | Cloudflare Workers Static Assets | SPA / PWA、CDN、edge 保護 |
| 通知 | Convex action からの Web Push | 本文を出さない到着通知 |
| Toolchain | Oxlint + Oxfmt + `tsc --noEmit` | lint / format / typecheck |
| テスト | Vitest + React Testing Library + Playwright | unit / integration / E2E |

## 原則として入れないもの

- Supabase Auth / PostgreSQL / RLS
- Hono の application API
- 手紙配送用の Cloudflare Cron
- R2 bucket への直接公開アクセス
- Convex data 向けの TanStack Query
- 必要性が出る前の Redux / Zustand
- Oxc 系と並べて入れる ESLint / Prettier

これらは runtime から外す。`supabase` CLI は `supabase/migrations/` の比較用にだけ残す。

## フロントエンドの provider

```text
MantineProvider
  └─ Auth0Provider
      └─ ConvexProviderWithAuth0
          └─ React Router
```

ログイン / ログアウト / 表示用の identity は `useAuth0()`、Convex へ認証済みリクエストできるかは `useConvexAuth()` を使う。ルート状態やブラウザが渡したユーザー識別子を認可の根拠にしない。

## Convex function のルール

- 登録する function はすべて args / return validator を持つ
- 既定は internal。React が直接呼ぶものだけ public にする
- ログイン必須の public function は現在ユーザーを解決し、所有権を強制する
- 増える読み取り経路は index と件数上限つき query / pagination を使う
- 状態遷移は mutation、外部副作用は action
- 正確な配送時刻と封をした本文は、許可されない return shape に含めない
- バックエンドの正本は `convex/` 配下の schema と functions

## サーバー状態の扱い

Convex の `useQuery` / `useMutation` / `useAction` を標準の data 取得経路にする。reactive query が cache と更新を持つので、`useEffect` での再取得ループや第二の query cache は入れない。

フォーム、モーダル、下書きエディタの一時状態は React state / context に置く。永続下書きは mutation で Convex へ保存する。

## Cloudflare の方針

Workers Static Assets を React SPA のデプロイ単位とする。

- `assets.not_found_handling = "single-page-application"`
- ハッシュ付き asset は Cloudflare cache を使う
- secret を browser bundle に含めない
- application API / database / scheduler は Convex に置く
- edge 固有のコードが必要になるまで Worker の入口は最小にする

## R2 の方針

- bucket は非公開
- object id / metadata / 所有権は Convex document に保存する
- Local と Preview は別 bucket・別 credential を使う。local Convex は DEV bucket を参照する。Production は別 Issue とする
- upload 前に JPEG / PNG / WebP、10 MiB 以下を検証し、Canvas 再 encode 後の JPEG を長辺 4096 px、5 MiB 以下にする
- upload 権限は5分、download 権限は60秒とする
- upload URL は5分だけ有効な staging key、Content-Length、`If-None-Match: *` に限定し、同じ権限での上書きを拒否する。finalize 時の HEAD でも intent の byte size と 5MB 上限へ一致することを強制する。検証後は attempt ごとの一意な final key を copy 前に永続登録し、ETag 条件付き copy のあと Convex の atomic winner だけを attachment へ確定する。負けた attempt は最大 action 時間を超える tombstone 期間中に再削除し、cron が削除成功まで追跡する
- finalize 時に MIME、size、dimension、EXIF / XMP / IPTC metadata が無いことをサーバー側で再検証する
- CORS は既知の Local / Preview origin と `PUT, GET, HEAD`、`Content-Type`・`Content-Length`・`If-None-Match` header だけを許可する
- 封をした / 未開封コンテンツの URL を client query に返さない

Convex File Storage の恒久 bearer URL は、あとからアクセス条件が変わる sealed media と相性が悪い。MVP の写真は R2 integration を採用する。

## 環境の方針

- Auth0: DEV tenant/application と PROD tenant/application を分離
- Google OAuth: DEV client と PROD client を分離
- Convex: local backend / preview / production deployment を分離する。日常の local 開発は local backend を正とし、cloud developer deployment の無料枠を消費しない。CI E2E は共有 Preview の remote Convex を参照する。手順は [Local / Preview 環境](../development/preview-environment.md)
- Cloudflare: preview / production environment を分離
- 環境変数は provider ごとに設定し、Git に secret を保存しない

## 移行メモ

Runtime は Auth0 + Convex。`supabase/migrations/` は production data の移行 / rollback 方針が固まるまで比較用に残す。通常の `pnpm test` は local Supabase を起動しない。最終削除は別 Issue と Human Gate で行う。
