# Production 環境

この文書は Production の構成・切替手順や。Preview / Local は
[preview-environment.md](preview-environment.md)、データ移行は
[convex-d1-migration.md](convex-d1-migration.md) を正とする。

**この文書を読んでも Auth0 / Cloudflare の本番リソースは作らない。**
Production の secret、データ投入、traffic 切替、legacy credential / project の削除は、各操作の直前に Human Gate を取る。

## 現在の状態

| 対象 | 状態 |
|---|---|
| Auth0 PROD / Google OAuth | 未作成。DEV / Preview と分離する |
| Cloudflare Worker `re-me` | config と名前は作成済み。Production deploy は未実施 |
| D1 `re-me` | 作成済み。`0001` / `0002` schema 適用済み、データ行は未投入 |
| R2 `re-me-production-attachments` | 作成済み。データは未投入 |
| Queue `re-me-production-notifications` | 作成済み。メッセージは未投入 |
| custom domain | 未設定。初回は `workers.dev` を使う |
| Convex production export | 未取得。データ移行の実行条件を満たしていない |

## URL と環境変数

初回 URL は次の固定 URL を使う。版付き Preview URL は Auth0 callback に使わへん。

```text
Production: https://re-me.hondasports.workers.dev
Preview:    https://re-me-preview.hondasports.workers.dev
```

GitHub environment `production` の Variables は名前だけ管理する。

```text
CLOUDFLARE_ACCOUNT_ID
PRODUCTION_BASE_URL
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_API_BASE_URL
VITE_WEB_PUSH_VAPID_PUBLIC_KEY
```

Secrets は次だけを Production に置く。値は Issue / PR / chat / git に貼らへん。

```text
CLOUDFLARE_API_TOKEN
CAPABILITY_SECRET
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Cloudflare API token は対象 account の Worker / D1 / R2 / Queue 操作に必要な最小権限へ絞り、Preview token と共有しない。`CAPABILITY_SECRET` と `VAPID_PRIVATE_KEY` は `VITE_*` にしない。

## Auth0 / Google

Human Gate 後に次を行う。

1. DEV と別の Auth0 PROD tenant / SPA application `Re:Me PROD` を作る
2. Google OAuth production client を DEV client から分離する
3. `https://re-me.hondasports.workers.dev/auth/callback`、logout URL、web origin を PROD だけに登録する
4. Worker の `AUTH0_DOMAIN` と `AUTH0_AUDIENCE` に PROD の値を設定する
5. DEV の test identity や E2E login credential を Production に置かない

ブラウザへ出してよいのは `VITE_AUTH0_DOMAIN`、`VITE_AUTH0_CLIENT_ID`、`VITE_API_BASE_URL`、VAPID public key だけや。

## Worker deploy

`main` のCIやPreview workflowから Production Workerへ deployせえへん。Production deployは、export / import / smoke / rollback packetが揃ったHuman Gate後に、対象checkoutで次を実行する。

```text
pnpm deploy:production
```

このscriptは production build、D1 migration適用、`wrangler deploy --env production`を順に行う。コマンドに渡すsecret値は表示せず、未設定ならそこで停止する。直接 `wrangler deploy` を単体で叩いて環境を取り違えない。

## Data cutover

1. Convex production export と source R2 inventory を取得し、checksum / row count を保存する
2. `pnpm migrate:convex-to-d1` の dry-run で orphan、ownership、reply chain、sealed visibility、scheduledAt projection を検証する
3. isolated local / Preview target で import・再実行・rollback・R2 checksum をリハーサルする
4. Production の R2 object を `migration/{cutoverId}/` へ copy・検証する
5. 明示Human Gate後に、生成SQLをProduction D1へ適用する
6. Worker API、Auth0、写真capability、due delivery、Queue outbox、critical E2Eを検証する
7. Production URLへ切替し、rollback window中はConvex export / legacy source / mappingを保持する
8. rollback window終了後、別Human GateでConvexの停止・credential rotation・不要resource削除を行う

Production exportが無いまま、空D1へ合成データやlocal / Preview dataを流し込んだらあかん。D1 importは本番への不可逆なデータ変更として扱う。

## Rollback

- Worker: 直前 version へ戻す
- D1: 同じ source checksum の rollback artifactだけを使う。既存行を推測で消さない
- R2: 今回の `migration/{cutoverId}/` prefix と inventoryに記載されたobjectだけを対象にする
- Convex: rollback window中は source / export を保持し、production data deletion は別Human Gate
- Auth0: ユーザー作成は完全rollbackできへん場合があるため、残存アカウントを記録する

## Smoke

本番にE2E database loginを常時置かへん。切替直後にだけ、次を値を貼らずに記録する。

1. `GET /api/health`
2. Auth0 PROD login → `/api/users/ensure` → authenticated query
3. draft → send、sealed delivery → open、reply → future send
4. 未開封sealed content、別user、期限切れcapabilityのdeny
5. Worker version / D1 migration / Queue / R2の対象環境が一致していること
