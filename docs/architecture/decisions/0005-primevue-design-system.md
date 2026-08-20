# ADR-0005: PrimeVue を UI 基盤にし、ブランド UI は専用実装する

- Status: Superseded
- Date: 2026-08-18
- Superseded by: [ADR-0008: Mantine を UI 基盤にし、ブランド UI は専用実装する](0008-mantine-design-system.md)

## Context

当初のデザインリファレンスは、淡い青・大きな余白・ガラス感・封筒 / 手紙・静かな通知を中心としており、操作 UI の accessibility と実装速度を担保するため PrimeVue を採用していた。

## Original Decision

- PrimeVue components を操作 UI の基盤として利用
- `@primeuix/themes` の Aura を土台に custom preset / design tokens を作成
- ブランド表現の強い画面は PrimeVue component の組み合わせだけで作らず専用 component と CSS を使う

## Why it was superseded

フロントエンド基盤を Vue から React へ変更したため、Vue 向けの PrimeVue を継続採用しない。

React 側では Mantine を採用し、当初 PrimeVue に期待していた以下の責務を引き継ぐ。

- 操作 component
- accessibility
- theme / design token integration
- modal / drawer / form / notification / layout primitives

「framework の default appearance を完成デザインとみなさず、Re:Me のブランド UI は custom component と theme で表現する」という原則は維持する。

## Historical Consequences

PrimeVue / `@primeuix/themes` / Aura preset は新規実装へ適用しない。

現在の UI decision は ADR-0008 を正とする。
