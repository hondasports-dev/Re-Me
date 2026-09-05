# Convex → D1 移行 runbook

Issue #60のdata migration用や。現在のapplication runtimeはCloudflare Worker + D1 + R2 + Queueへ切り替え済みの実装で、Convexはproduction cutoverのsource / rollback windowが終わるまで保持するlegacy backendや。

Productionのexport、R2 copy、D1 import、traffic切替、Convex data削除は、resource inventoryと明示Human Gateが揃うまで実行したらあかん。

## 現在のinventory

| 対象 | 状態 |
|---|---|
| Production D1 `re-me` | 作成済み、`0001` / `0002`適用済み、data row 0 |
| Production R2 `re-me-production-attachments` | 作成済み、object 0 |
| Production Queue `re-me-production-notifications` | 作成済み、message 0 |
| Preview D1 / R2 / Queue | 分離済み、Preview用schema適用済み |
| Convex production export | 未取得。実データimportは未実施 |
| source R2 inventory / credential | 未取得。R2 copyは未実施 |

空のtarget resourceを作ってschemaを適用しただけではdata migration完了とはみなさへん。

## 1. 入力 export

operatorがConvex productionから取得したexportを、git管理外の `migration-artifacts/` に置く。tableごとのJSONLなら1行1documentで、少なくとも `_id` と `_creationTime` を含める。raw dump、R2 inventory、secretをrepositoryへcommitせえへん。

対応table:

```text
users
userSettings
threads
letters
letterContents
letterAttachments
attachmentFinalizationAttempts
letterDeliveries
notificationJobs
pushSubscriptions
```

単一JSON object、table単位のJSON array / JSONL、table fileを含むdirectoryを読める。Convex Dashboard / export toolの実際の形式は取得後に変換し、変換前後のchecksumを保存する。

## 2. dry-run

まずtargetへ接続せず検証する。

```text
pnpm migrate:convex-to-d1 -- --input migration-artifacts/convex-export
```

dry-runはsource checksum、row count、R2 object count、warningを表示する。次を検出したらSQLを生成せず停止する。

- owner / thread / letter / attachmentのorphan
- sent letterのdelivery欠落、draftのdelivery
- delivery windowの逆転、sent stateの必須時刻欠落
- reply parentのowner / thread不一致、cycle、branch
- deleted / delivered stateの矛盾
- photoのR2 object欠落、location label欠落
- duplicate content / delivery / notification / push endpoint
- invalid enum、timestamp、body size、identity mapping

## 3. SQL artifact と local rehearsal

schemaをlocal D1へ適用し、同じartifactを二回実行できることとchecksum driftで止まることを確認する。

```text
pnpm exec wrangler d1 migrations apply re-me-local --local
pnpm migrate:convex-to-d1 -- --input migration-artifacts/convex-export --sql --output migration-artifacts/rehearsal-import.sql --rollback-output migration-artifacts/rehearsal-rollback.sql --manifest-output migration-artifacts/rehearsal-manifest.json --r2-cutover-id rehearsal-20260905
pnpm exec wrangler d1 execute re-me-local --local --file=migration-artifacts/rehearsal-import.sql
pnpm exec wrangler d1 execute re-me-local --local --file=migration-artifacts/rehearsal-import.sql
pnpm exec wrangler d1 execute re-me-local --local --file=migration-artifacts/rehearsal-rollback.sql
```

`--sql` はSQL / rollback / manifestを生成するだけで、remote D1 / R2 APIを呼ばへん。`migration_import_keys` がsource IDとchecksumを保持し、partial retry、同一artifactの再実行、変更されたsourceの `migration_checksum_drift` を扱う。

返信chainは親を先に登録し、全letter登録後に `next_letter_id` を設定する。rollbackは `next_letter_id` を外してから子を削除する。

## 4. R2 copy rehearsal

manifestの各objectについて、source key → `migration/{cutoverId}/` のtarget keyへcopyする。copy後にetag、byte size、JPEG policy、object keyを照合し、D1 attachment rowを参照させるのは検証完了後だけや。location attachmentにはR2 objectを作らへん。

R2 objectのcopy実行はsource credentialとtarget bucketを明示したoperator scriptで行う。source / targetが同じでないこと、target prefixがcutover IDで隔離されていることを先に確認する。既存objectを上書き・削除しない。

## 5. Preview verification

Preview D1へproduction exportを流し込まへん。合成fixtureまたはredacted fixtureで次を検証する。

- User A / B ownership denial
- sealed traveling / delivered-unopenedの本文 deny
- sent letter body / attachment immutable
- exact `scheduledAt` がbrowser responseに無い
- draft → send、delivery → open、reply → future send
- delivery sweepのoverlap / retryとnotification outboxの分離
- R2 upload / finalize / download capabilityの期限、所有者、用途検証
- Preview critical Playwright E2E

## 6. Production cutover（Human Gate）

次のpacketが揃うまでproductionへ書き込まへん。

```text
source export checksum / table counts
source R2 inventory / target copy manifest / checksum
identity mappingとorphan report
local rehearsal import / rerun / rollback evidence
Preview Worker / D1 / R2 / Queue smoke evidence
rollback owner、対象prefix、rollback window
```

明示Human Gate後にだけ、次の順で実行する。

1. source R2 objectをProduction bucketのimmutable cutover prefixへcopyし、checksumを再確認
2. 生成SQLをProduction D1へ一度だけ適用し、row count / checksum mapを確認
3. `pnpm deploy:production` でWorker build、schema確認、Production Worker deployを行う
4. Auth0 PROD login、API、sealed、reply、Queue、R2 capabilityをsmokeする
5. Production URLへtrafficを切り替える

Production D1 importは不可逆なdata mutationや。`--environment production --human-gate` はSQL生成の明示フラグであって、import / cutoverの承認を代替せえへん。

## 7. Rollback

- Workerは直前versionへ戻す
- D1は同じsource checksumのrollback artifactだけを使う
- R2は今回のcutover prefixとmanifest記載keyだけを対象にする
- Convex export / source / mappingはrollback window中保持する
- Auth0 user作成が残る場合は記録する

Convex production dataの削除、旧secretの無効化、unused resourceの削除はrollback window終了後の別Human Gateや。

## Human Gate

明示承認が必要:

- Production export / import
- Production data mutation
- Production traffic cutover
- legacy Production data deletion
- irreversible credential / project deletion

不要:

- local schema compare
- mapping unit test
- dry-run / SQL artifact生成
- このrunbookの更新
