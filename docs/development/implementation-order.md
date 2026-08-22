# Implementation order

1. Auth0 / Convex / Cloudflare foundation
2. Convex schema / authorization test harness
3. Auth0 Google OAuth + Convex auth integration
4. Supabase auth / query layer removal
5. Compose / Draft
6. Private R2 photo via Convex authorization
7. Send / Immutability
8. Traveling letters
9. Convex Cron delivery / Notification outbox
10. Inbox / Open
11. Reply / Thread
12. PWA / Push
13. Data migration / legacy cleanup / rollback rehearsal
14. CI / E2E / production readiness hardening

Production data が存在する場合、13 は Human Gate なしに実行しない。
