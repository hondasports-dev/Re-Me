# Production readiness

この文書は本番切替前の確認表や。Issue #38のProduction構成は
[production-environment.md](production-environment.md)、データ移行のrunbookは
[convex-d1-migration.md](convex-d1-migration.md) を見る。旧legacy mappingは
[legacy-migration.md](legacy-migration.md) に残す。

## 環境分離

| 境界 | DEV / Local | Preview / CI E2E | Production |
|---|---|---|---|
| Auth0 | DEV tenant / SPA | DEV + Preview callback | PROD tenant / SPA |
| Worker | local runtime | `re-me-preview` | `re-me` |
| D1 | `re-me-local` | `re-me-preview` | `re-me` |
| R2 | DEV bucket | `re-me-preview-attachments` | `re-me-production-attachments` |
| Queue | local | `re-me-preview-notifications` | `re-me-production-notifications` |
| GitHub | なし | environment `preview` | environment `production` |

- ProductionのAPI token、capability secret、VAPID private keyをLocal / Previewへ入れない
- Previewの `E2E_ALLOW_FORCE_DELIVERY=1` はPreview configだけに置き、Productionは `0`
- CIのQuality gatesはlive backendへ接続せず、Worker / migration / legacy compatibility testを実行する
- CIのEnd-to-endはCloudflare Preview Workerへdeployしたrevisionを対象にする

検証の正本は `tests/unit/ci-convex-boundary.test.ts` と `tests/worker/` や。ファイル名はlegacy boundaryの互換性を表すだけで、runtime接続先はWorkerやで。

## Secret inventory / rotation

Browser に出してよい:

- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`
- `VITE_API_BASE_URL`
- `VITE_WEB_PUSH_VAPID_PUBLIC_KEY`

Browser に出さない:

- `CLOUDFLARE_API_TOKEN`
- `CAPABILITY_SECRET`
- `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`
- Auth0 client secret / Management API token
- E2E Auth0 email / password
- production export、R2 credential、D1 dump

回転は providerで新しい値を発行 →対象環境だけ更新 →health / capability / push smoke →旧値無効化の順や。値はIssue、PR、ログへ出さへん。

## Backup / export / restore

- Convex exportはcutover前とrollback window中のsource snapshotとして保持する
- R2 inventoryはsource key、target key、etag、byte sizeを持ち、copyはcutover prefixに閉じる
- D1 import SQL / rollback SQL / manifest はartifact storeへ置き、gitへproduction dumpをcommitしない。git に production dump を置かない
- Restore は production への書き込みなので Human Gate が必要や
- Previewへproduction exportを流し込まない。Preview へ production export を流し込まない

## 監視

Workerのinternal operator query / D1 consoleでは次を確認する。Browser responseには本文、写真object key、exact `scheduledAt`を出さへん。

- 最古のpending deliveryでdueになったもの
- `notificationJobs` の pending / failed / processing 各status内で最古の `availableAt`
- 同じletterのnotification jobが複数ないこと
- claim は `pending` → `failed` → `processing` の順で、各 status 内だけ `availableAt` の古い順
- processing lock timeoutが再claimされ、delivered letterがtravelingへ戻らないこと
- deleting attachmentがR2失敗時にreconcileへ残ること

## アカウント復旧 / provider 継続

- ProductionはAuth0 PROD + production Google clientを使う
- Re:Meはpasswordを保持せず、Google / Auth0の復旧手順に従う
- logout後は通常clientから保護データを読めない
- Auth0障害時にDEVへproduction userを逃がさない

## Data export / 削除

- 手紙の削除は論理削除で、誤送信・プライバシーの救済を優先する
- account全体の物理削除・backupからの抹消期間はprivacy policy確定後に別Human Gateで決める
- notification payloadに本文・写真を載せない
- Convex production data、旧credential、旧resourceの削除はrollback window終了後の別PR + Human Gateや

## Vendor outage

障害時にAgentがProductionを作り直したり、PreviewをProductionの代わりにしたりせえへん。

| 依存 | 影響 | 復旧の向き |
|---|---|---|
| Auth0 | login不能 | PROD tenantのstatusを待つ。DEVへ逃がさない |
| Cloudflare Worker / D1 | API / lifecycle停止 | version、D1 migration、healthを確認し、必要ならrollback gate |
| R2 | 写真のupload / read停止 | capability、bucket、対象prefixを確認。既存objectを消さない |
| Queue / Push service | 通知だけ遅延 | letterはdeliveredのまま。outboxをretryする |

復旧sweepでは最古のpending delivery / failed notification / deleting attachmentを数え、checksumが変なら移行runbookのrollbackを検討する。書き込みと削除はHuman Gateや。

## 完了条件

- production export / R2 inventory / checksumが保存済み
- Previewでcritical E2Eとaccess-controlがPASS
- Production D1のimport row countとR2 object countが一致
- Workerのhealth、Auth0、sealed、reply、notification outboxを確認
- traffic切替後のrollback windowを開始し、legacy sourceを保持
- window終了後のcleanupは別Human Gateで実施
