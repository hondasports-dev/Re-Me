# Production readiness

この文書は [Issue #13](https://github.com/hondasports-dev/Re-Me/issues/13) の本番準備チェックリストである。Production Auth0 / Convex / Cloudflare の **作成そのもの** は [Issue #38](https://github.com/hondasports-dev/Re-Me/issues/38) の Human Gate。ここを読んでも production を作らない・書き込まない。

Local / Preview の接続先は [preview-environment.md](preview-environment.md)。legacy の棚卸し / dry-run / rollback は [legacy-migration.md](legacy-migration.md)。

## 環境分離

| 境界 | DEV / Local | Preview / CI E2E | Production |
|---|---|---|---|
| Auth0 tenant / SPA | DEV | 同じ DEV + Preview callback | PROD（#38） |
| Google OAuth client | DEV client | DEV client | 別の production client |
| Convex | local backend | 共有 Preview | production deployment（#38） |
| Cloudflare Worker | Vite / local Worker | `re-me-preview` | production Worker（#38） |
| R2 | DEV bucket | Preview bucket | production bucket（#38） |
| GitHub | なし | environment `preview` | production environment（#38 後） |

- Preview の `CONVEX_PREVIEW_DEPLOY_KEY` を production に使わない
- production deploy key / Auth0 PROD secret を Local / Preview / PR CI に入れない
- CI の Quality gates は live Convex を使わない。E2E だけ Preview へ `convex deploy` する
- PR CI から production Convex へは deploy しない

検証は `tests/unit/ci-convex-boundary.test.ts`。値はテストにも docs にも書かない。

## Secret inventory / rotation

名前だけを持つ。値は GitHub / Convex / Cloudflare / Auth0 の各コンソールに置く。

**Browser に出してよい**

- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_CONVEX_URL`
- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`

**Browser に出さない**

- Auth0 client secret / Management API token（SPA では通常使わない）
- Convex deploy key（Preview / production を分ける）
- Convex 上の `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID`（server 検証用）
- R2 access key / secret / endpoint
- Web Push VAPID **private** key
- Cloudflare API token
- E2E Auth0 database の email / password（GitHub `preview` secret と local `.env.local` のみ）

回転:

1. provider 側で新しい値を発行する
2. 対象 environment / Convex deployment だけを更新する
3. 古い値を無効化する
4. 値を Issue / PR / chat / git に貼らない

## Backup / export / restore

- Convex: Dashboard の export を cutover 前と rollback window 中の正本にする。手順と Human Gate は [legacy-migration.md](legacy-migration.md)
- R2: cutover 前に inventory を取り、copy は cutover prefix に閉じる。失敗時は **その prefix / inventory だけ** を消す
- Auth0: ユーザー作成は rollback できないことがある。data を戻しても login が残る場合は記録する
- git に production dump を置かない

Restore は production への書き込みなので Human Gate。Preview へ production export を流し込まない。

## 監視

運用者が Convex Dashboard / internal query で見る。public function に exact `scheduledAt` や本文を出さない。

- 最古の `letterDeliveries.status = pending` かつ due
- 最古の `notificationJobs.status` が `pending` / `failed` / `processing` の `availableAt`
- 同じ letter の job が複数ないこと（delivery test が回帰を止める）
- claim は `availableAt` の古い順。retry は `nextNotificationAvailableAt` の backoff

## アカウント復旧 / provider 継続

- Production は Auth0 PROD + production Google client（#38）
- Google アカウント側の復旧は Google / Auth0 の手順に従う。Re:Me は password を持たない
- DEV test identity を production にコピーしない
- ログアウト後は通常 client から保護データを見えない。E2E は Auth0 database session で確認する

## Data export / 削除

- 手紙の削除は論理削除。誤送信・プライバシーの救済を優先する（プロダクト原則）
- 本文 / 添付 / delivery は既存の delete mutation の契約に従う
- アカウント全体の物理削除・backup からの抹消期間はプライバシーポリシー確定後。それまでは operator Human Gate
- 通知 payload に本文・写真を載せない契約は変えない

## Vendor outage

障害時に Agent が production を作り直したり、Preview を production の代わりにしたりしない。

| 依存 | 影響 | 復旧の向き |
|---|---|---|
| Auth0 | ログイン不能 | tenant の status を待つ。DEV へ production ユーザーを逃がさない |
| Convex | 読書き・cron・push outbox が止まる | Convex status。due な配送は復旧後の idempotent cron に任せる |
| Cloudflare Worker / R2 | 静的配信・写真 | Preview と production を取り違えない |
| Push service | 通知だけ遅延 | letter は delivered のまま。outbox を retry する。delivered を戻さない |

復旧 sweep: 最古の pending delivery / failed notification を数え、checksum が変なら [legacy-migration.md](legacy-migration.md) の rollback を検討する。書き込みは Human Gate。

## #30 との関係

- いまの棚卸しは `no_production_import`（#38 未着手）
- production 行が生まれたら `import_required`
- cutover / rollback / R2 prefix 削除は #30 の Human Gate を使う
- この文書は rehearsal の代わりにならない
