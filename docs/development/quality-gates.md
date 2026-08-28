# 品質ゲート

実装 Issue の Done 条件として、変更内容に応じて以下を通す。

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

重要なユーザー操作を変える場合は `pnpm test:e2e` を実行する。ユーザーが見える画面 / 遷移を足す・変える場合は、**変更した画面そのもの** を踏む Playwright が必須である。未実装の critical 3本や、変更していない login E2E の成功を省略理由・代替証拠にしない。credential 不足は `NOT_REQUIRED` ではなく BLOCKED とする。

通常の品質ゲート / `pnpm test` は local Supabase を起動しない。認可 / schema は `pnpm test:convex` で検証する。

## Convex のゲート

CI の品質ゲートは `pnpm test:convex` を必須 step にする。`convex-test` の in-memory harness で認可 / schema を検証し、live Convex deployment は使わない。

CI の End-to-end job は GitHub environment `preview` の共有 Preview Convex を使う。Playwright の前に PR checkout を `convex deploy` し、frontend と backend の revision を揃える。個人の cloud developer deployment は CI から参照しない。接続先の表は [Local / Preview 環境](./preview-environment.md) を正とする。

Local の `pnpm convex:check` / `pnpm convex:dev` は local backend が対象。cloud developer deployment へ push しない。

Convex の schema / function を変更する場合:

- local では `convex dev --once` 相当（`pnpm convex:check`）で local backend へ push / 検証する
- CI E2E では共有 Preview へ `convex deploy`
- generated API / TypeScript typecheck
- args / return validator
- index を使った件数上限つき読み取り
- public / internal の境界確認
- 変更した認可 / 状態遷移テスト（`pnpm test:convex`）

## 必須の認可テスト

- 未認証の拒否
- ユーザー A / ユーザー B の分離
- 封をした traveling / 到着済み未開封の本文拒否
- 開封後の本文アクセス
- 送信後コンテンツの変更不可
- 正確な配送時刻が漏れないこと
- 配送 / 通知の internal function を public にしない
- R2 の upload / download 権限の所有権と期限切れ

## 今回変えた画面の E2E

ユーザーが見える画面 / 遷移 / 操作を変えたら、その path を踏む Playwright を実行する。既存 spec が無いなら追加する。

## MVP までに揃える critical E2E

通常 E2E は Google OAuth UI を経由せず、Auth0 の database test identity で session を作り `e2e/.auth/` に保存して使う。以下は MVP の下限であり、これ以外の画面の E2E を省略する根拠にはしない。

1. 認証済み session → 下書き → 送信
2. 封をした手紙が到着 → 開封 → 本文が見える
3. 開封 → 返信 → 未来へ送る

## Google OAuth / Auth0 smoke

少数の smoke test で以下を確認し、外部 credential のない通常 CI では明示的に skip する。

1. Google OAuth login が始まる
2. Auth0 callback が成功する
3. token が発行される
4. Convex が issuer / audience / 署名を検証する
5. 認証済み query が成功する

## 配送 / 通知

- 重なった cron で二重配送しない
- due / 削除済み / 現在状態を再検証する
- 配送と outbox 作成が atomic
- push 失敗で delivered 状態を戻さない
- 古い generation の完了を拒否する
- retry / backoff / 最古の pending 監視を検証する

## Cloudflare / R2

- SPA fallback と static asset build
- bucket 非公開
- 封をした / 未開封 attachment URL の非公開
- MIME / size / dimension / EXIF の扱い
- metadata / object 削除の部分失敗からの復旧

## 本番準備

本番切り替え前に以下を別ゲートとする。

- Auth0 DEV / PROD の分離
- Convex deployment / 環境の分離
- Cloudflare preview / production の分離
- backup / export / restore のリハーサル
- legacy Supabase データの棚卸しと移行判断
- rollback 計画
- 枠 / 課金 / アラートの確認
