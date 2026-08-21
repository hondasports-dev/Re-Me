---
name: requirements
description: PREPARE で Goal / Scope / AC / Spec Confidence / Risk / Required Controls / Verification plan を最小 packet にまとめる。
---

# PREPARE / Requirements

PREPARE の目的は、実装前に必要な判断を一度だけ固定することや。長い設計会議や risk 起点の複数 requirements reviewer は使わへん。

## 1. Spec Confidence

- `C2 confirmed`: 目的・期待結果・主要 AC が明確で material conflict なし
- `C1 reconstructed`: 不足はあるが authoritative evidence から成果物をほぼ一意に復元可能
- `C0 unclear`: 複数の妥当な仕様が残る
- `C0 conflicted`: authoritative source 同士が desired state で矛盾する

`C0` のまま Implementation へ進まへん。

Source priority:

1. current user instruction
2. latest approved spec / ADR / decision
3. current Issue / comments
4. canonical docs
5. tests
6. current implementation / existing pattern

独立 Spec Review は `C1` で material choice が残る、または復元仕様が protected behavior を変える場合だけ最大1 reviewer を使う。Risk が高いだけでは reviewer 数を増やさへん。

## 2. Minimal PREPARE packet

```text
Goal:
In scope:
Out of scope:
Preserve:
Acceptance Criteria:
Spec confidence:
Risk:
Required controls:
Verification plan:
Impact summary:
```

Current behavior / edge state などは AC や control 判定に必要な分だけ書く。

## 3. Risk

4軸 `0..2`:

- Blast Radius
- Data / Security
- Reversibility
- Uncertainty

目安:

- 0..2 → R1
- 3..4 → R2
- 5..8 → R3

`R0` は typo / pure docs / formatting / behavior-preserving micro change。

R4 は production DB migration、不可逆 data mutation、account deletion semantics、authorization model overhaul、production secret rotation、DNS cutover など明示的 critical operation に限定する。

Risk は変更種類のラベルではなく影響度で決める。Auth / RLS / schema に触れただけで自動的に R3 にせず、必要な品質確認は Controls で追加する。

新しい evidence で Risk は即時昇格できる。Implementation 開始後は `max_observed_level` を completion の最低 profile とし、後から Risk を下げて Verification / REVIEW を軽くする用途には使わへん。

## 4. Required Controls

変更に応じて必要な control だけ選ぶ。

- `security_review`: auth / authorization / RLS / secret / input / external write boundary
- `db_access_control`: schema / migration / RLS / grant / RPC / trigger
- `destructive_or_stateful`: delete / retention / rollback / idempotency / critical state transition
- `service_ops`: Cloudflare / Supabase / OAuth / R2 / GitHub write / env / secret operation
- `human_gate`: R4、production、不可逆操作、protected finding acceptance

Control は Risk Profile と独立して追加できる。

## 5. Impact depth

通常の impact は PREPARE の `impact_summary` に統合する。

次の場合だけ `skills/impact-analysis/SKILL.md` を追加で読む。

- cross-cutting change
- shared state / multiple callers
- auth / data / schema / external write の影響が不明
- rollback / deployment impact を深掘りする必要がある

新しい material impact が見つかったら Risk / Controls をその場で更新する。
