# ADR-0010: Cloudflare D1 migration foundation

## Status

Accepted for the Issue #60 foundation. Worker/API cutover and production migration remain separate gates.

## Context

Re:Me の現行 runtime は Auth0 + Convex + Cloudflare Workers Static Assets である。Issue #60 の target は、Auth0 を残したまま application data を D1、private photo object を Worker の R2 binding、非同期通知を Queues、配送の起動を Cron へ段階的に移すことや。

この段階で Convex runtime と client を先に外すと、既存の送信済み手紙、sealed 本文、exact delivery time、返信の一本道を同時に壊すリスクが高い。また、本番 resource / export の存在をこの repository からは確認できへんため、production data に対する自動操作は許可しない。

## Decision

1. D1 の schema を `migrations/0001_initial_schema.sql` に置き、Convex document ID を D1 の `TEXT` ID として保持する。
2. local / Preview / Production は Wrangler の named environment ごとに D1、R2、Queue、Cron binding を分離する。binding の名前は共通でも、resource name は環境ごとに別にする。
3. `scripts/convex-to-d1-migration.ts` は Convex export の検証、relationship / ownership の検証、D1 SQL、R2 copy manifest、rollback SQL を生成する。default は dry-run で、D1 / R2 API は呼ばない。
4. import は source table + source ID と source checksum を `migration_import_keys` に記録する。source の checksum または target mapping の drift は SQLite trigger で拒否する。
5. import SQL は migration map が無い行だけを挿入し、既存 source の再実行は同じ map を更新する。target の予期せぬ unique conflict は statement を失敗させ、既存行を黙って上書きしない。atomic な実行が必要な runner は D1 `batch()` を使う。
6. 本文と attachment metadata の sent 後 immutable boundary、sealed + unopened の read denial、`scheduled_at` の private boundary を D1 schema / migration validator / test で維持する。
7. Production export、R2 copy、D1 import、traffic cutover、Convex cleanup はこの変更に含めず、個別の Human Gate で実行する。

## Consequences

### Positive

- schema と import の再現可能な review artifact ができる。
- Convex ID / relationship / identity mapping を変換せずに rehearsal できる。
- import の checksum drift、orphan、branching reply、sent state inconsistency を適用前に検出できる。
- R2 本体は SQL に埋め込まず、copy と checksum 検証を別工程にできる。

### Trade-offs

- この段階では application API はまだ Convex のままや。D1 を直接 browser から触る API は作らへん。
- D1 resource の作成、remote migration、R2 object copy、production cutover は operator の手順と Human Gate が必要や。
- D1 の `TEXT` ID を採用するため、将来の backend 実装は Convex の ID type ではなく、認証済み user と relationship を Worker 側で検証せなあかん。

## Rejected alternatives

- **Convex runtime と並行して D1 を browser から直接読む**: 認可の source が二つになり、sealed content の denial と state transition の正本が曖昧になるため採用しない。
- **target ID を新しく採番する**: relationship と rollback の検証が mapping table に依存し、identity / reply chain の誤接続を検出しにくいため採用しない。
- **import で `ON CONFLICT DO NOTHING` を使って既存行を黙って無視する**: 部分移行や別データへの衝突を見逃すため採用しない。
