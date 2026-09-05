# ADR-0010: Cloudflare D1 migration foundation

## Status

Historical record. Superseded for current runtime cleanup by
[ADR-0012](0012-cloudflare-only-preview-runtime.md).

## Context

この ADR は、Re:Me を Cloudflare Worker / D1 / private R2 / Queue へ移行する初期段階
の判断を記録する。Production resource、export、data import、traffic cutover は
当時も自動処理へ含めず、Human Gate の対象としていた。

## Recorded decisions

1. D1 schema は numbered migration を正本にし、relationship を保てる text ID を採用する。
2. Local / Preview / Production は Wrangler の named environment ごとに D1、R2、Queue、
   scheduled binding を分離する。
3. Worker が Auth0 identity、ownership、sealed visibility、immutable state transition
   を検証し、D1 を browser から直接読ませない。
4. exact delivery time は browser projection から隠し、delivery と notification outbox
   を別 state として扱う。
5. R2 object は private とし、capability、ETag、generation、reconcile state を使う。

## Current result

Cloudflare Worker / D1 / R2 / Queue の実装と Preview cutover は完了した。Production は
未デプロイ・未投入で、Preview data は migration source にしない。初期 migration の
一時 bookkeeping table は `0003_remove_legacy_import_bookkeeping.sql` で撤去する。

旧設計を再導入する source、client、scheduler、dependency、CI job、migration CLI は
現行 repository に戻さない。
