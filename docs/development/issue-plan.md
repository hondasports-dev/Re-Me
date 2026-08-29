# 初期実装の Issue 計画

```text
アーキテクチャ判断
  ↓
Auth0 + Convex の土台
  ↓
Convex schema + 認可
  ↓
Auth0 Google OAuth connection + Convex 認証
  ↓
legacy Supabase 境界の撤去
  ↓
作成 / 下書き
  ├─ 写真 / private R2
  └─ 送信 / 封
       ↓
Convex 配送 / 通知
  ↓
受信箱 / 開封
  ↓
返信 / スレッド
  ↓
PWA / Push
  ↓
移行片付け / CI 強化
```

Auth0 tenant、Convex deployment、Cloudflare environment の用意と production write を同じ Issue に混ぜない。Production data の移行は棚卸し、dry-run、rollback、Human Gate を独立した受け入れ条件にする。

各 Issue は最新の [ADR-0009](../architecture/decisions/0009-auth0-convex-cloudflare.md) を正本とし、旧 Supabase Issue / PR の記述だけで target architecture を上書きしない。
