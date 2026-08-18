# 認証・セキュリティ

## Auth

Supabase Auth を使用し Social Login を中心にする。MVP 第一候補は Google。Apple は追加候補。

## RLS

すべてのユーザーデータは `user_id` を持ち、本人だけがアクセスできるよう RLS を設定する。SELECT / INSERT / UPDATE / DELETE ごとにポリシーを明示する。

## Service Role

強い credential はブラウザへ渡さない。GitHub へコミットせず Worker Secret 等で管理する。

## Sealed letter

「封をする」は MVP では **UX 上の閲覧制御** とする。

- ユーザー画面では到着まで読めない
- 「運営も技術的に絶対読めない」とは表現しない

運営からも読めないことを保証する場合は E2EE / 鍵管理 / 復旧モデルを含めて別 ADR を作成する。

## Notification privacy

Push / Email 通知に本文、写真、正確な場所などを含めない。

## Photo privacy

- EXIF 除去
- private object として扱う
- 認可なしで取得できない URL 設計にする

## Deletion

送信後編集不可でも削除は可能とする。物理削除 / 論理削除 / バックアップ保持期間は Privacy Policy と合わせて決定する。

## Account longevity

数か月〜数年後に戻ることが正常系なので、ログイン方法の継続性、アカウント復旧、メール変更、Provider 変更、退会・データ削除を重視する。
