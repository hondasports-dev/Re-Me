# Production readiness

この文書は本番切替前の確認表や。[production-environment.md](production-environment.md)
が構成手順、[legacy-migration.md](legacy-migration.md) が「移行不要」と判断した
inventory の記録や。

## 環境分離

| 境界 | DEV / Local | Preview / CI E2E | Production |
|---|---|---|---|
| Auth0 | DEV tenant / SPA | DEV + Preview callback | PROD tenant / SPA |
| Worker | local runtime | `re-me-preview` | `re-me`（未デプロイ） |
| D1 | `re-me-local` | `re-me-preview` | `re-me`（未投入） |
| R2 | local bucket | `re-me-preview-attachments` | `re-me-production-attachments` |
| Queue | local | `re-me-preview-notifications` | `re-me-production-notifications` |
| GitHub | なし | environment `preview` | environment `production` |

- Production の API token、capability secret、VAPID private key を Local / Preview へ入れない
- Preview の `E2E_ALLOW_FORCE_DELIVERY=1` は Preview config だけに置く
- CI Quality gates は live backend に接続せず、Worker / migration / API test を実行する
- CI End-to-end は Cloudflare Preview Worker へ deploy した revision を対象にする

検証の正本は `tests/unit/cloudflare-runtime-boundary.test.ts` と `tests/worker/` や。

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
- Production export、R2 credential、D1 dump

回転は provider で新しい値を発行 →対象環境だけ更新 →health / capability / push smoke
→旧値無効化の順や。値は Issue、PR、ログへ出さへん。

## Backup / export / restore

- 現在 Production data は未投入で、migration export / import は不要や
- D1 migration は repository の numbered SQL を正本にする
- Production を将来 backup / restore する場合は対象 inventory、checksum、retention、
  rollback artifact を別 task で準備する
- Restore は Production への書き込みなので Human Gate が必要や
- Preview へ Production data を流し込まない

## 監視

Worker の operator log / D1 console では次を確認する。Browser response には本文、写真
object key、exact `scheduledAt` を出さへん。

- due の pending delivery と最古の scheduled time
- notification job の pending / failed / processing
- 同じ letter の notification job が複数ないこと
- processing lock timeout が再 claim されること
- delivered letter が traveling へ戻らないこと
- deleting attachment が reconcile へ残り、成功後に減ること

## アカウント復旧 / provider 継続

- Production は Auth0 PROD + Production Google client を使う
- Re:Me は password を保持せず、Google / Auth0 の復旧手順に従う
- logout 後は通常 client から保護データを読めない
- Auth0 障害時に DEV へ Production user を逃がさない

## Data export / 削除

- 手紙の削除は論理削除で、誤送信・プライバシーの救済を優先する
- account 全体の物理削除・backup からの抹消期間は privacy policy 確定後に別 Human Gate で決める
- notification payload に本文・写真を載せない
- 未使用の Cloudflare resource や credential の削除は対象を限定した別 PR + Human Gate で行う

## Vendor outage

障害時に Agent が Production を作り直したり、Preview を Production の代わりにしたり
せえへん。

| 依存 | 影響 | 復旧の向き |
|---|---|---|
| Auth0 | login 不能 | 対象 tenant の status を待つ。DEV へ逃がさない |
| Cloudflare Worker / D1 | API / lifecycle 停止 | version、migration、health を確認し、必要なら rollback gate |
| R2 | 写真 upload / read 停止 | capability、bucket、対象 prefix を確認。既存 object を消さない |
| Queue / Push service | 通知だけ遅延 | letter は delivered のまま。outbox を retry する |

## 完了条件

- Preview の critical E2E と access-control が PASS
- Production Auth0 / Worker / D1 / R2 / Queue の対象環境が一致
- Production deploy 前に data inventory が空であることを再確認
- Worker health、Auth0、sealed、reply、notification outbox を smoke
- Production の初回 deploy / data write は Human Gate を通過
