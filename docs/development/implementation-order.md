# 実装順

1. Auth0 DEV、Cloudflare Worker、D1、R2、Queue の環境境界を定義する
2. D1 numbered migration と Worker の request / response contract を固定する
3. Auth0 access token の検証と D1 user / owner 解決を実装する
4. React provider、API client、Router guard を接続する
5. 作成 / 下書き自動保存 / delivery settings を実装する
6. Worker 認可付きの private R2 写真 upload / finalize / download を実装する
7. 送信 / 編集不可 / sealed visibility を D1 transaction と trigger で強制する
8. 未来を旅する手紙、受信箱、開封を実装する
9. Worker scheduled sweep、delivery state、notification outbox を実装する
10. Queue consumer、Web Push、retry / endpoint disable を実装する
11. 返信 / 一本道のスレッド / 返信の future send を実装する
12. PWA、settings、削除、長期利用の復旧導線を整える
13. Worker / D1 / R2 / Queue integration と critical Playwright E2E を追加する
14. Preview deploy、smoke、CI required checks、production readiness を整える
15. Production の初回構築・data write・traffic 切替を別 Human Gate task で行う

Preview の runtime cutover と repository の旧 backend 撤去は完了済みや。Production は
未デプロイ・未投入なので、Preview data を移行元にしたり、合成データで migration を
代用したりせえへん。将来本番 data が発生したら、inventory / export / dry-run /
rollback を含む別 task を先に作る。
