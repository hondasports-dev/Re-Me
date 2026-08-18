---
name: service-ops-safety
description: Cloudflare、Supabase、GitHub、OAuth、R2、環境変数、secret、deploy 等の外部サービス操作を安全に扱う。全 task で常時適用する。
---

# Service Operations Safety

## 基本原則

1. 対象環境を明示する: local / preview / production
2. read と write を分ける
3. secret 値を表示しない
4. production を通常環境として扱わない
5. 不可逆・高影響操作は Human Gate を通す
6. 環境不足を理由に必須 Verification を省略しない

外部サービス操作前に確認する。

```text
Service:
Environment:
Operation: read | write
Target resource:
Expected effect:
Rollback / recovery:
Secret involved: yes | no
Human Gate required: yes | no
```

## Re:Me の対象

- Cloudflare Workers / R2 / Cron / DNS
- Supabase Auth / PostgreSQL / RLS / Storage configuration
- Google OAuth
- GitHub / GitHub Actions
- Web Push / VAPID
- `.env*` / Worker Secret / Supabase Service Role

## Secret boundary

- Supabase Service Role、VAPID private key、OAuth secret を browser bundle へ入れない。
- `.env.local`、`.dev.vars` 等を commit / PR / log へ出さない。
- Browser-visible key と server-only secret を混同しない。
- Secret rotation を副次作業として勝手に行わない。

## Human Gate required

ユーザーの明示許可なしに次を write しない。

- production deploy
- production DB migration / data mutation
- production env / secret の追加・更新・削除
- OAuth production credential の変更
- secret / VAPID / signing key rotation
- DNS / domain 変更
- billing / plan 変更
- 大量・不可逆 data mutation

必須環境がなく Verification できない場合は DONE ではなく BLOCKED とする。
