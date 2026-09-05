# Issue plan

## 現在の実装ライン

1. Auth0 DEV と Cloudflare Worker / D1 / R2 / Queue の環境分離
2. Worker API の認証・所有権・sealed visibility
3. draft → send → delivery → open → reply の domain flow
4. private photo capability と attachment reconcile
5. Scheduled Worker と Queue による delivery / notification
6. Preview deploy、critical Playwright、required CI checks
7. Production 初回構築と traffic 切替（未着手・別 Human Gate）

Issue の acceptance criteria は、この repository の Worker / D1 contract と
[アーキテクチャ概要](../architecture/overview.md) を正本にする。Preview は Cloudflare
runtime を使い、Production data import は未実施や。

## 完了済みの整理

Cloudflare Preview への runtime cutover は完了し、旧 backend の source、client、
scheduler、dependency、CI job、migration CLI は撤去済みや。Preview に残る外部
resource の停止は対象確認付きの service operation として別管理する。

## 未着手

- Auth0 PROD tenant / Google OAuth Production client
- Production Worker / D1 / R2 / Queue 初回 deploy
- Production user / letter data の投入
- Production traffic cutover と運用 runbook

Production 操作や external resource の停止・削除は、対象と rollback を明示した
別 Issue + Human Gate で行う。
