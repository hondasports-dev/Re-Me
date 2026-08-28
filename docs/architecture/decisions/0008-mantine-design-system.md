# ADR-0008: Mantine を UI 基盤にし、ブランド UI は専用実装する

- 状態: 採用
- 日付: 2026-08-20
- 置換対象: [ADR-0005](0005-primevue-design-system.md)

## 背景

Re:Me のデザインリファレンスは、淡い青・大きな余白・ガラス感・封筒 / 手紙・静かな通知を中心とする。

React へ frontend framework を変更するにあたり、フォーム・Dialog・Drawer・Select・Notification などの操作 UI をすべて自作せず、アクセシビリティと実装速度を担保できる React UI framework が必要になった。

一方で、強い default 見た目をそのまま採用すると Re:Me の世界観を損ないやすい。

## 決定

UI framework は Mantine を採用する。

- Mantine components は操作 UI / layout / アクセシビリティの基盤として利用する
- `MantineProvider` と Re:Me theme を application provider に集約する
- 色 / typography / radius / spacing / shadow 等は Mantine theme と `src/styles/tokens.css` へ寄せる
- ブランド表現の強い画面は Mantine component の組み合わせだけで作らず、専用 React component と CSS / styles API を使う

## Mantine に任せるもの

- Button
- TextInput / Textarea
- Modal / Drawer
- Select
- Switch / Checkbox
- Tabs
- Notification
- Skeleton / loading
- 基本の layout primitives

## 専用実装するもの

- 便箋
- 封筒 / 封印
- 未来を旅する手紙
- 到着 / 開封演出
- 時間をまたぐスレッド
- ランディングのビジュアル

## デザイントークン

最低限以下を token 化する。

- color: navy / sky / surface / paper / muted
- typography
- radius
- shadow
- spacing
- motion の duration / easing

実装 component 内で hex color や shadow 値を大量に直書きしない。

## アクセシビリティ

Mantine が提供する keyboard / focus / aria の振る舞いを不用意に壊さない。

専用 component でも以下を考慮する。

- キーボード操作
- 見えるフォーカス
- 意味のある要素
- スクリーンリーダー向けラベル
- 動きを減らす設定
- 十分なコントラスト

## Mantine を選んだ理由

- React 向けの component / hooks / theme API がまとまっている
- モバイルファーストアプリの基本 UI を短時間で構成しやすい
- theme / styles API により Re:Me 固有の表現へ寄せられる
- 専用 component と混在させやすく、手紙・封筒・時間軸を framework default に縛られず実装できる

## 帰結

- PrimeVue / `@primeuix/themes` は新規実装で使用しない
- Mantine の default 見た目は完成デザインとみなさない
- mockup と異なる場合は framework に合わせず theme / 専用 component 側を調整する
- UI の共通値は `src/styles/theme.ts` / `src/styles/tokens.css` を中心に管理する
- Tailwind は必須依存にしない
- framework を使わないブランド component でもアクセシビリティを同等に扱う
