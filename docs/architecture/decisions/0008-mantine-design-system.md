# ADR-0008: Mantine を UI 基盤にし、ブランド UI は専用実装する

- Status: Accepted
- Date: 2026-08-20
- Supersedes: [ADR-0005](0005-primevue-design-system.md)

## Context

Re:Me のデザインリファレンスは、淡い青・大きな余白・ガラス感・封筒 / 手紙・静かな通知を中心とする。

React へ frontend framework を変更するにあたり、フォーム・Dialog・Drawer・Select・Notification などの操作 UI をすべて自作せず、accessibility と実装速度を担保できる React UI framework が必要になった。

一方で、強い default appearance をそのまま採用すると Re:Me の世界観を損ないやすい。

## Decision

UI framework は Mantine を採用する。

- Mantine components は操作 UI / layout / accessibility の基盤として利用する
- `MantineProvider` と Re:Me theme を application provider に集約する
- color / typography / radius / spacing / shadow 等は Mantine theme と `src/styles/tokens.css` へ寄せる
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
- 基本 layout primitives

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
- typography
- radius
- shadow
- spacing
- motion duration / easing

実装 component 内で hex color や shadow 値を大量に直書きしない。

## Accessibility

Mantine が提供する keyboard / focus / aria behavior を不用意に壊さない。

custom component でも以下を考慮する。

- keyboard operation
- visible focus
- semantic element
- screen reader label
- reduced motion
- sufficient contrast

## Why Mantine

- React 向けの component / hooks / theme API がまとまっている
- mobile-first application の basic UI を短時間で構成しやすい
- theme / styles API により Re:Me 固有の表現へ寄せられる
- custom component と混在させやすく、手紙・封筒・時間軸を framework default に縛られず実装できる

## Consequences

- PrimeVue / `@primeuix/themes` は新規実装で使用しない
- Mantine の default appearance は完成デザインとみなさない
- mockup と異なる場合は framework に合わせず theme / custom component 側を調整する
- UI の共通値は `src/styles/theme.ts` / `src/styles/tokens.css` を中心に管理する
- Tailwind は必須依存にしない
- framework を使わないブランド component でも accessibility を同等に扱う
