# Re:Me Agent Loop v2

Re:Me の Agent Loop は、品質を Gate 数で担保せず、**Acceptance Criteria・必要な Control・検証 Evidence** で担保する。

正本:

- `AGENTS.md` — project invariant / safety invariant
- `.loop/process.yaml` — loop / risk / control / state の正本
- `skills/*/SKILL.md` — 現在工程または条件に該当したときだけ読む手順
- `.loop/templates/task-state.yaml` — 最小 task state / Finding Ledger

## 表記ルール

`.loop/process.yaml` は Agent が読む実行契約である一方、`task-state.yaml` や各 Skill から参照される安定した識別子も持つ。

そのため、以下のルールで記述する。

- YAML の key は英語のまま維持する。
- `prepare` / `verification` / `r2_medium` / `c0_unclear` / `fix_now` / `merge_ready` などの state ID・Risk ID・Spec Confidence ID・enum・action ID は英語のまま維持する。
- Skill path、file path、field name など機械的に参照される値は変更しない。
- 原則、trigger、required condition、blocking rule、完了条件など Agent が意味として読む自然言語は日本語で記述する。
- 既存の機械識別子を日本語へ置き換えて、`task-state.yaml` や Skill との対応関係を壊さない。

## Design principles

```text
維持する:
  C0 は Implementation を BLOCK する
  writer は原則1体
  Acceptance Criteria ベースで Verification する
  Risk / Control が要求する場合だけ independent review する
  open finding は Delivery を BLOCK する
  PR Aftercare は merge-ready まで続ける

削る:
  Gate のための Gate
  finding の重複記録
  Risk の高さだけを理由にした複数 Agent の Requirements 討論
  無条件の specialist review
  無条件の Process Learning
  commit だけが変わった場合の full re-validation
```

## Default loop

```text
TASK
 ↓
PREPARE
 ↓
IMPLEMENT
 ↓
VERIFY
 ↓
REVIEW? ── only when profile/control requires
 ↓
DELIVER
 ↓
PR AFTERCARE
 ↓
DONE
```

`Human Gate`、`Incident`、`Process Learning` は常設の直列 Gate ではなく、必要時だけ割り込む side path や。

## PREPARE

PREPARE で次だけを固定する。

- Goal
- In scope / Out of scope
- Acceptance Criteria
- Spec Confidence
- Risk
- Required Controls
- Verification plan

### Spec Confidence

- `C2`: 目的・期待結果・主要 AC が明確
- `C1`: docs / tests / existing pattern からほぼ一意に復元可能
- `C0 unclear`: 複数の妥当な成果物が残る
- `C0 conflicted`: authoritative source が desired state で矛盾する

`C0` のまま実装へ進まへん。

独立 Requirements Review は Risk の高さだけでは増やさない。`C1` の復元に material choice が残る場合や、復元した仕様が protected behavior を変える場合だけ最大1 reviewerを使う。

## Risk と Control を分ける

Risk は変更そのものの影響度を表し、Control は変更種類に必要な品質確認を表す。

例:

```text
small RLS fix
  risk: R2
  controls: security_review + db_access_control

production DB migration
  risk: R4
  controls: db_access_control + destructive_or_stateful + human_gate
```

Auth / RLS / schema に触れたという理由だけで、Requirements reviewer 数・Process Learning・全 specialist review をまとめて増やさへん。

## Review policy

通常の独立 reviewer は最大1体。

```text
Reviewer ─→ Finding Ledger ─→ Root disposition
```

Reviewer 同士は議論させへん。R4 や明確に異なる専門領域が必要な場合だけ specialist を並列追加し、root が1回だけ統合する。

Security は独立した直列 Gate ではなく Review の control や。Security control が必要なときだけ `skills/security-review/SKILL.md` を読む。

## Finding Ledger

Finding は `.loop/templates/task-state.yaml` の `findings` が唯一の source of truth や。

Review finding、Verification gap、Residual risk を別レコードへ転記せえへん。同じ finding を同じ ID のまま更新する。

```yaml
findings:
  - id: F001
    source: review
    category: security
    finding: cross-user access may be possible
    risk_domains: [authorization]
    disposition: fix_now
    resolution: ""
    verified_revision: ""
```

修正・再検証後は同じ record を `resolved` にする。

これにより `source_finding_ids`、`source_fidelity`、同じ `test_gap` の多重コピーと、それらの転記整合性を保証する大量の Gate は廃止する。

### Blocking rules

- `open` / `fix_now` は Delivery BLOCKED
- `test_gap` は fix または Requirements / AC 再評価のみ
- protected domain は agent 単独 defer 不可
- Human acceptance は approval evidence 必須
- `not_applicable` は proof 必須

## Revision / Evidence

Evidence は対象 revision を示すが、同じ SHA を工程ごとに何度も構造化コピーせえへん。

Task state は基本的に次を持つ。

```text
current
verified
reviewed
published
observed
```

commit SHA に加えて tree SHA を取れる場合は tree を使う。

### Head changed

```text
new commit
  ↓
same tree?
  ├ yes → evidence reuse
  └ no  → changed delta を verify / review
             ↓
          protected behavior / AC coverage / risk が変化?
             ├ yes → required scope を再実行
             └ no  → delta evidence を追加
```

rebase や commit metadata だけで tree が同じなら、Verification / Review を全量やり直さへん。

## Verification

「全部ローカルで回せば安全」ではなく、AC と Control に対応する最小十分な検証をする。

- R0/R1: targeted
- R2: affected scope
- R3: full affected scope
- R4: R3 + recovery evidence

CI が repository-wide required checks を同じ content に対して実行するなら、ローカルで理由なく同じ full suite を二重実行しない。

## Delivery / Aftercare

PR 作成は checkpoint であって completion ではない。

Default target は `merge_ready`。

Aftercare は latest PR content について次を確認する。

- required CI success
- actionable blocking finding なし
- requested changes なし
- conflict なし
- mergeable

PR head が変わったら tree / diff を確認し、変更された範囲だけ evidence を更新する。内容が同じなら既存 evidence を再利用する。

ユーザーが明示的に「PR作成まで」と指定した場合だけ Aftercare を省略できる。

## Conditional skill loading

毎taskで全 Skill をコンテキストへ入れへん。

通常は:

```text
AGENTS.md
.loop/process.yaml
current state の Skill
```

だけ読む。

以下は該当 trigger がある時だけ読む。

- prompt injection guard
- service operations safety
- impact analysis
- security review
- finding disposition helper
- incident
- process learning
- session cleanup

基本安全則は `AGENTS.md` / `process.yaml` に短く保持し、詳細 Skill の常時ロードを避ける。

## Process Learning

Risk が高いだけでは Full Learning を起動せえへん。

次のような **learning event** がある場合だけ実施する。

- human correction
- unexpected CI / E2E / Gate failure
- actionable review finding that should have been caught earlier
- retry / incident
- scope / impact miss
- delivery / aftercare miss

イベントがなければ `none` で閉じる。
