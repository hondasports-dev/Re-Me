# Convex → D1 移行リハーサル

この手順は Issue #60 の移行 foundation 用や。Production の export / R2 copy / D1 import / cutover は、resource inventory と明示 Human Gate が揃うまで実行したらあかん。

## 1. 入力 export

`migration-artifacts/` 以下に、Convex document を table ごとの JSONL として置く。1 行 1 document で、少なくとも `_id` と `_creationTime` を含めること。次の table 名に対応する。

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

単一 JSON object（`{ "users": [...] }`）、table 単位の JSON array / JSONL、または table ファイルを含む directory も読める。export の raw dump、R2 inventory、secret は repository に置かへん。

## 2. dry-run（既定）

まず検証だけする。これは D1 / R2 へ接続せず、source checksum、row count、R2 object count、warning を表示する。

```bash
pnpm migrate:convex-to-d1 -- --input migration-artifacts/convex-export
```

検証で拒否する代表例は次の通りや。

- owner / thread / letter / attachment の orphan
- sent letter の delivery 欠落、draft の delivery
- `deliveryWindowStart > deliveryWindowEnd`
- sent state の必須時刻欠落
- reply parent の owner / thread 不一致、deleted / delivered でない親、cycle、branch
- photo の R2 object 欠落、location の label 欠落
- duplicate content / delivery / notification / push endpoint
- invalid enum、timestamp、body size、identity mapping

## 3. local SQL と schema

schema migration は local D1 にだけ適用する。

```bash
pnpm d1:migrations:apply:local
pnpm migrate:convex-to-d1 -- --input migration-artifacts/convex-export --sql --output migration-artifacts/rehearsal-import.sql --rollback-output migration-artifacts/rehearsal-rollback.sql --manifest-output migration-artifacts/rehearsal-manifest.json --r2-cutover-id rehearsal-20260905
pnpm exec wrangler d1 execute re-me-local --local --file=migration-artifacts/rehearsal-import.sql
```

`--sql` は SQL artifact を生成するだけで、remote D1 / R2 の操作はしない。target の予期せぬ conflict は statement failure として扱い、そこで停止する。Worker 側で atomic に適用する場合は、生成された statement 配列を D1 `batch()` に渡す。再実行時は `migration_import_keys` が source ID と checksum を照合し、source が変わっていれば `migration_checksum_drift` で停止する。

返信チェーンの自己参照は、親 letter を先に登録し、`next_letter_id` を全 letter 登録後に確定する二段階で適用する。rollback は先に `next_letter_id` を外してから、返信の子を先に削除する。途中失敗時は同じ artifact を再実行するか、checksum 一致を確認した rollback artifact を isolated target に適用する。

生成される manifest の R2 list は、source key、target key、etag、byte size を記録するだけや。R2 object の copy と checksum verification が完了する前に、D1 の attachment row を本番へ入れたらあかん。

`letterDeliveries.scheduledAt` は配送判定用の private data として D1 に保持するが、browser-facing metadata へは含めへん。

## 4. rollback rehearsal

import の row count、relationship、owner、sealed read denial、private schedule projection を確認してから、同じ isolated local target に rollback SQL を適用する。rollback は source map と checksum が一致する行だけを対象にする。

```bash
pnpm exec wrangler d1 execute re-me-local --local --file=migration-artifacts/rehearsal-rollback.sql
```

R2 の rollback は manifest の target key を確認し、copy 済み object を別途削除する。削除は production では必ず Human Gate の対象や。

## 5. Preview / Production の扱い

Wrangler の config には local / `preview` / `production` の resource 名を分けて書いてある。実在する database ID、bucket、queue が作成されるまでは placeholder の resource name のままや。remote command に `--remote` を付けたり、Production binding を手動で作ったりするのはこの task の範囲外や。

Production 用 SQL artifact を生成する場合も、意図を明示するため `--environment production --human-gate` が必要や。ただしこれは SQL 生成の確認フラグであって、import / delete / traffic cutover の承認を代替せえへん。

## 6. 移行後に別途必要な検証

- Worker API の Auth0 JWT 検証と current-user 解決
- User A / B ownership denial、sealed traveling / unopened denial
- send / open / reply の transaction と同時実行
- Cron delivery の overlap / retry
- Queue notification の at-least-once / idempotency
- Worker R2 capability、expiration、EXIF / location leakage
- Preview critical E2E

この repository の current runtime はまだ Convex や。D1 schema と rehearsal が通っただけでは cutover 完了とはみなさへん。
