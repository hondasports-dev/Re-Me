# 実装順

1. Auth0 / Convex / Cloudflare の土台
2. Convex schema / 認可テストの harness
3. Auth0 Google OAuth + Convex 認証の接続
4. Supabase の auth / query 層の撤去
5. 作成 / 下書き
6. Convex 認可経由の private R2 写真
7. 送信 / 編集不可
8. 旅する手紙
9. Convex Cron 配送 / 通知 outbox
10. 受信箱 / 開封
11. 返信 / スレッド
12. PWA / Push
13. データ移行 / legacy 片付け / rollback リハーサル（手順は [legacy-migration.md](legacy-migration.md)。Production write は Human Gate）
14. CI / E2E / 本番準備の強化（[production-readiness.md](production-readiness.md)）
15. Production 環境の構成（手順は [production-environment.md](production-environment.md)。作成は Human Gate）

Production data がある場合、13 は Human Gate なしに実行しない。
