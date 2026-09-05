# Production 環境

この文書は Production の構成・初回切替手順や。Preview / Local は
[preview-environment.md](preview-environment.md) を正とする。

**この文書を読んでも Auth0 / Cloudflare の本番リソースは作らない。**
Production の secret、data 投入、traffic 切替、resource の停止・削除は、各操作の
直前に対象を確認して Human Gate を取る。

## 現在の状態

| 対象 | 状態 |
|---|---|
| Auth0 PROD / Google OAuth | 未作成。DEV / Preview と分離する |
| Cloudflare Worker `re-me` | config と名前は作成済み。Production deploy は未実施 |
| D1 `re-me` | schema resource は作成済み。業務 data は未投入 |
| R2 `re-me-production-attachments` | 作成済み。object は未投入 |
| Queue `re-me-production-notifications` | 作成済み。message は未投入 |
| custom domain | 未設定。初回は `workers.dev` を使う |
| legacy data import | 不要。Production runtime / user / data は未開始 |

Production に既存データが無いことが今回の前提や。もし将来 data が見つかったら、
この手順を続けず、inventory / export / dry-run / rollback を含む専用 migration task
へ戻る。

## URL と環境変数

初回 URL は次の固定 URL を使う。版付き Preview URL は Auth0 callback に使わへん。

```text
Production: https://re-me.hondasports.workers.dev
Preview:    https://re-me-preview.hondasports.workers.dev
```

GitHub environment `production` の Variables:

```text
CLOUDFLARE_ACCOUNT_ID
PRODUCTION_BASE_URL
VITE_AUTH0_DOMAIN
VITE_AUTH0_CLIENT_ID
VITE_API_BASE_URL
```

Secrets:

```text
CLOUDFLARE_API_TOKEN
CAPABILITY_SECRET
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

Cloudflare API token は対象 account の Worker / D1 / R2 / Queue 操作に必要な最小権限へ
絞り、Preview token と共有しない。private key や capability secret は browser bundle
へ出さへん。

## Auth0 / Google

Human Gate 後に次を行う。

1. DEV と別の Auth0 PROD tenant / SPA application を作る
2. Google OAuth Production client を DEV client から分離する
3. Production callback / logout / web origin を登録する
4. Worker の Auth0 issuer / audience を Production 値に設定する
5. DEV の test identity や E2E credential を Production に置かない

## Worker deploy

`main` の CI や Preview workflow から Production Worker へ deploy せえへん。Production
deploy は config、secret、health、smoke、rollback packet が揃った Human Gate 後に
対象 checkout で次を実行する。

```text
pnpm deploy:production
```

この script は production build、D1 migration 適用、Production Worker deploy を順に
行う。未設定の secret や対象環境の不一致があればそこで停止する。

## Data

現在は Production のユーザー・業務データを投入していないため、切替前 import は行わない。
Local / Preview の data を Production へコピーしたらあかん。初回リリースで必要になった
data が存在する場合だけ、別 task で次を設計する。

1. source inventory、checksum、row / object count を保存する
2. isolated target で mapping、access-control、sealed visibility、reply chain、
   scheduledAt privacy、R2 checksum、rerun を dry-run する
3. rollback artifact と cutover / retention window を用意する
4. 明示 Human Gate 後に Production D1 / R2 へ限定的に投入する
5. Worker、Auth0、Queue、R2、critical E2E を確認する

合成データや Preview data を本番移行の代わりに使わへん。

## Rollback

- Worker: 直前 version へ戻す
- D1: 適用済み migration の状態を確認し、推測で既存行を消さない
- R2: inventory で対象を限定し、既存 object を勝手に消さない
- Auth0: callback / issuer / audience の対象環境を再確認する

## Smoke

本番に E2E database login を常時置かへん。初回切替直後にだけ、値を貼らずに次を記録する。

1. `GET /api/health`
2. Auth0 Production login → `/api/users/ensure` → authenticated API
3. draft → send、sealed delivery → open、reply → future send
4. 未開封 sealed content、別 user、期限切れ capability の deny
5. Worker version / D1 migration / Queue / R2 の対象環境が一致すること
