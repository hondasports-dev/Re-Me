# Legacy data migration status

## 結論

2026-09-05 時点で Production の Auth0 / Worker は未構築、Production D1 / R2 は
業務 data 未投入や。Preview の application runtime は Cloudflare Worker / D1 / R2 /
Queue へ移行済みで、Preview data は migration source にしない。

したがって今回の cutover では production data import は不要や。旧 backend の source、
client、scheduler、dependency、CI job、migration CLI は repository から撤去し、D1 の
一時 import bookkeeping も `0003_remove_legacy_import_bookkeeping.sql` で削除する。

## 棚卸し

| 対象 | 状態 | 扱い |
|---|---|---|
| Production user / letter | 未投入 | import 不要 |
| Production R2 object | 未投入 | copy 不要 |
| Preview D1 / R2 / Queue | Preview 専用 | migration source にしない |
| `supabase/migrations/` | 過去 schema artifact | 比較・履歴確認だけに使う |
| ignored local artifact | developer machine 依存 | commit / upload しない |

## 再開条件

将来 Production に既存 data が見つかった場合は、この文書の結論を流用せず、作業を
止めて別 task を起こす。その task には最低限、source inventory、export、checksum、
row / object count、ownership / sealed visibility 検証、dry-run、rerun、rollback、
retention window、Human Gate を含める。

合成 data や Preview data を Production migration の代わりに使わへん。Production の
data write、traffic 切替、旧外部 resource の停止・削除は、この cleanup PR の scope
には含めない。
