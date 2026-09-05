# Initial issues draft

このファイルは初期設計時の issue 草案を、現在の Cloudflare-only runtime に合わせて
更新した記録や。

## 実装済みの中心機能

- Auth0 login と Worker JWT verification
- D1 の draft / send / open / delete / reply state transition
- sealed letter の本文・添付 visibility
- private R2 photo capability
- Scheduled Worker の delivery sweep
- Queue の notification outbox / retry
- React / TanStack Query の mobile flow
- Preview deploy と critical E2E

## 今後の issue 候補

- Auth0 PROD tenant / Google OAuth Production client
- Production Worker / D1 / R2 / Queue の初回構築
- Production の backup / export / retention policy
- Production traffic cutover と運用監視

Production 操作は Preview data を流用せず、inventory、rollback、Human Gate を含む
別 issue として作る。初期草案にあった別 backend の schema / client / scheduler /
migration CLI は現行 repository へ追加しない。
