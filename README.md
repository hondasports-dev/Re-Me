# Re:Me

> **未来のあなたへ**

Re:Me は、今の自分から未来の自分へ手紙を送り、時間をまたいで自分自身と会話するための、モバイルファースト Web アプリです。

## コンセプト

- 今の気持ち・判断・迷い・出来事を、分類せず自由な手紙として残す
- 届ける時期は「数日後くらい」「数週間後くらい」「数か月後くらい」などのざっくり指定、または「未来に任せる」
- 手紙は「封をする / 封をしない」を選べる
  - **封をする**: 到着まで自分でも本文を読めない
  - **封をしない**: 送信後も読み返せる
- 送信後の内容は編集できない
- 到着した手紙には返信でき、その返信もさらに未来へ送れる
- 返信を重ねることで、数年単位の「自分との会話」が一つのスレッドとして育つ

## プロダクト原則

1. **時間そのものを体験にする**
2. **分類しない** — 日記・ToDo・判断ログの型を押し付けない
3. **送信した瞬間を固定する** — 送信後は編集不可。ただし安全のため削除は可能
4. **内容を不用意に露出しない** — 通知に本文・写真を出さない
5. **機能より余白を優先する** — Re:Me の世界観に寄与しない機能は増やさない
6. **モバイルファースト** — 「ふと残したい瞬間」と「突然届く瞬間」をスマートフォン中心に設計する

## 基本フロー

```text
手紙を書く
  ↓
届ける時期を選ぶ
  ↓
封をする / しない
  ↓
未来へ送る
  ↓
未来を旅する
  ↓
到着通知
  ↓
開封する
  ↓
読む
  ↓
返信を書く
  ↓
返信も未来へ送る
```

## デザインリファレンス

実装時の主要な画面構成・遷移・トーン&マナーは、以下のモバイルファースト UI コンセプトを基準にします。

![Re:Me モバイル画面遷移](docs/design/re-me-mobile-flow.jpg)

詳細は [デザインリファレンス](docs/design/README.md) と [UX / 画面遷移](docs/product/ux-flow.md) を参照してください。

## MVP 技術方針

- **Web**: モバイルファースト Web App / PWA
- **Hosting / Backend**: Cloudflare
- **Auth**: Supabase Auth（Social Login を中心に検討）
- **Database**: Supabase PostgreSQL + RLS
- **Image Storage**: Cloudflare R2
- **Delivery / Notification**: Cloudflare Workers + Cron Triggers
- **Push**: Web Push を第一候補。到着保証の観点からメール通知も将来検討

> 無料枠は MVP / 初期検証のために活用する。本番運用では、可用性・休止条件・容量・料金を再評価する。

## ドキュメント

- [プロダクトビジョン](docs/product/vision.md)
- [要件定義](docs/product/requirements.md)
- [UX / 画面遷移](docs/product/ux-flow.md)
- [MVP スコープ](docs/product/mvp.md)
- [アーキテクチャ概要](docs/architecture/overview.md)
- [データモデル](docs/architecture/data-model.md)
- [認証・セキュリティ](docs/architecture/auth-security.md)
- [手紙の配送・通知](docs/architecture/delivery-notifications.md)
- [ADR: Cloudflare + Supabase](docs/architecture/decisions/0001-cloudflare-supabase.md)
- [ADR: 送信後編集不可](docs/architecture/decisions/0002-immutable-letter.md)
- [ADR: ざっくり配送](docs/architecture/decisions/0003-delivery-window.md)
- [デザインリファレンス](docs/design/README.md)
- [開発ルール](AGENTS.md)

## ステータス

現在はプロダクト要件・UX・アーキテクチャを設計している初期フェーズです。
