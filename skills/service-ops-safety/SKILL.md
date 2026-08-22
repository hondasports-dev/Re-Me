---
name: service-ops-safety
description: Cloudflare、Auth0、Convex、Supabase legacy、GitHub、OAuth、R2、env、secret、deploy など外部サービス操作がある task で読む詳細 Safety Skill。基本 invariant は AGENTS.md に常時保持する。
---

# Service Operations Safety

基本原則「secret を出さない」「production / irreversible write は明示承認なしに行わない」「必須 Verification を環境不足で省略しない」は `AGENTS.md` に常時保持する。

この Skill 全文は、Cloudflare / Auth0 / Convex / Supabase legacy / OAuth / R2 / GitHub write / env / secret / deploy など service operation が実際にある時だけ読む。

## Operation check

1. 対象環境を明示する: local / preview / production
2. read と write を分ける
3. secret 値を表示しない
4. production を通常環境として扱わない
5. 不可逆・高影響操作は Human Gate を通す
6. 環境不足を理由に必須 Verification を省略しない

外部サービス write 前に必要な分だけ確認する。

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

Read-only の軽微な問い合わせで上記 packet を毎回フル生成する必要はない。

## Re:Me の対象

- Cloudflare Workers / R2 / DNS
- Auth0 tenant / application / connection / custom domain
- Convex deployment / schema / function / environment
- legacy Supabase Auth / PostgreSQL / RLS の移行・撤去
- Google OAuth
- GitHub / GitHub Actions
- Web Push / VAPID
- `.env*` / Convex environment / Worker Secret / deploy key

## Secret boundary

- Auth0 Management credential、Convex deploy key、R2 secret、VAPID private key、OAuth secret を browser bundle へ入れない。
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
