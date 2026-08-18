# ADR-0005: PrimeVue を UI 基盤にし、ブランド UI は専用実装する

- Status: Accepted
- Date: 2026-08-18

## Context

デザインリファレンスは、淡い青・大きな余白・ガラス感・封筒 / 手紙・静かな通知を中心とする。

Material Design のような強い既定表現をそのまま使うと Re:Me の世界観から外れやすい。一方、フォーム・Dialog・Select・Toast などを全て自作すると accessibility と実装速度で不利になる。

## Decision

UI framework は PrimeVue を採用する。

- PrimeVue components は操作 UI の基盤として利用
- `@primeuix/themes` の Aura を土台に custom preset / design tokens を作成
- ブランド表現の強い画面は PrimeVue component の組み合わせだけで作らず専用 component と CSS を使う

## PrimeVue に任せるもの

- Button
- Input / Textarea
- Dialog / Drawer
- Select
- Toggle / Checkbox
- Toast
- Tabs
- Skeleton / loading

## Custom にするもの

- 便箋
- 封筒 / 封印
- 未来を旅する手紙
- 到着 / 開封演出
- 時間をまたぐ thread
- Landing visual

## Design tokens

最低限以下を token 化する。

- color: navy / sky / surface / paper / muted
- radius
- shadow
- spacing
- typography
- motion duration / easing

実装 component 内で hex color や shadow 値を大量に直書きしない。

## Consequences

- PrimeVue の default appearance は完成デザインとみなさない
- mockup と異なる場合は framework に合わせず theme / custom component 側を調整する
- Tailwind は必須依存にしない
- framework を使わないブランド component でも keyboard / focus / reduced-motion を考慮する
