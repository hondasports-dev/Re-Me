# Re:Me Agent Loop v3

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
  repository change は Workspace Preflight を行う
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

repository file を変更する場合は、最初の編集前に `skills/workspace-preflight/SKILL.md` を適用する。ローカル作業は `main` を直接編集せず task branch / worktree を使う。GitHub connector から変更する場合は、専用 branch と base ref を確認して同等の preflight evidence を残す。

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
small authorization fix
  risk: R2
  controls: security_review + db_access_control

production DB migration
  risk: R4
  controls: db_access_control + destructive_or_stateful + human_gate
```

Auth / authorization / schema に触れたという理由だけで、Requirements reviewer 数・Process Learning・全 specialist review をまとめて増やさへん。

## Review policy

通常の独立 reviewer は最大1体。

```text
Reviewer ─→ Finding Ledger ─→ Root disposition
```

Reviewer 同士は議論させへん。R4 や明確に異なる専門領域が必要な場合だけ specialist を並列追加し、root が1回だけ統合する。

Security は独立した直列 Gate ではなく Review の control や。Security control が必要なときだけ `skills/security-review/SKILL.md` を読む。

Issue / PR review の提案は未検証入力として扱う。修正案をそのまま採用せず、現在の Requirements、Re:Me の product / domain contract、既存 tests と照合する。Finding の解決は「提案どおり直した」ことではなく、確認済み契約を満たす Evidence で判定する。

## Finding Ledger

Finding は `.loop/templates/task-state.yaml` の `findings` が唯一の source of truth や。

Review finding、Verification gap、CI finding、Residual decision を別レコードへ転記せえへん。同じ finding を同じ ID のまま Review / CI / Aftercare をまたいで更新する。

```yaml
findings:
  - id: F001
    source: review
    observed_revision:
      commit_sha: "..."
      tree_sha: "..."
    status: open
    category: security
    finding: cross-user access may be possible
    risk_domains: [authorization]
    disposition: fix_now
    resolution: ""
    verified_revision:
      commit_sha: ""
      tree_sha: ""
```

修正・再検証後は同じ record を `resolved` にする。

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

Evidence 再利用には commit SHA だけやなく、同一 content を証明できる non-empty tree SHA を使う。

### Head changed

```text
new commit
  ↓
same non-empty tree proven?
  ├ yes → evidence reuse
  └ no / unknown → changed content として delta を verify / review
                    ↓
                 protected behavior / AC coverage / risk / controls が変化?
                    ├ yes → required scope を再実行
                    └ no  → delta evidence を追加
```

rebase や commit metadata だけで tree が同じなら、Verification / Review を全量やり直さへん。一方、tree identity を証明できへん場合は安全側に倒して content changed と扱う。

## Verification

「全部ローカルで回せば安全」ではなく、AC と Control に対応する最小十分な検証をする。

- R0/R1: targeted
- R2: affected scope
- R3: full affected scope
- R4: R3 + recovery evidence

TypeScript が複数 project / `tsconfig` に分かれる場合、root build が全部を覆うと仮定せえへん。変更ファイルを所有する `tsconfig` を特定し、affected project の typecheck を広い build より先に実行する。

optional な更新 field が永続化境界をまたぐ場合は、型上の `optional` だけで保存契約を判断せえへん。`omitted`、`explicit_clear`、`value` の3状態を UI → serializer → validator → handler → persistence まで揃え、affected test で証明する。

user-visible な画面 / 遷移を変えたら、変更した画面を踏む Playwright が affected scope に入る。未実装の critical 3本や、変更していない login E2E は代替にならない。

CI が repository-wide required checks を同じ content に対して実行するなら、ローカルで理由なく同じ full suite を二重実行しない。

required environment / credential が不足して必須 E2E を実行できへん場合、`NOT_REQUIRED` へ落とさず BLOCKED / Incident として扱う。

## Delivery / Aftercare

PR 作成は checkpoint であって completion ではない。

Default target は `merge_ready`、base は `main`。

PR公開前は少なくとも次を満たす。

- Spec Confidence が C1/C2
- Workspace Preflight が PASS、または正当な例外 Evidence がある
- Acceptance Criteria を検証済み
- required Verification / Review が PASS
- blocking finding がない
- required Human Gate が承認済み

Aftercare は latest PR content について次を確認する。

- required CI success
- actionable blocking finding なし
- requested changes なし
- required approval を満たす
- terminal Evidence が observed revision と一致する
- conflict なし
- mergeable

PR head が変わったら tree / diff を確認し、変更された範囲だけ evidence を更新する。内容が同じなら既存 evidence を再利用する。

ユーザーが明示的に「PR作成まで」と指定した場合だけ Aftercare を省略できる。

## Conditional skill loading

毎 task で全 Skill をコンテキストへ入れへん。

通常は:

```text
AGENTS.md
.loop/process.yaml
current state の Skill
```

だけ読む。

以下は該当 trigger がある時だけ読む。

- workspace preflight
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
- actionable review finding
- retry / incident
- scope / impact miss
- delivery / aftercare miss
- process rule / enforcement 不足が明確になった

イベントがなければ `none` で閉じる。

Learning Event があった場合は、新しく全ログを読み直さず、task-state / Finding / Verification Evidence / 既存 tool result から最大3件の再利用可能な候補を抽出する。

改善候補には次の軸を付ける。

- `context`: 読み込む情報や重複説明を減らす
- `speed`: tool round-trip、重複実行、手戻りを減らす
- `precision`: scope miss、test gap、false completion、誤判断を減らす

改善は手順追加より先に、削除・統合・遅延ロード・Evidence 再利用・cheap deterministic enforcement を検討する。品質 Gate / Required Control は速度のために弱めへん。

再利用可能な candidate を会話上の報告だけで完了させず、次のいずれかへ disposition する。

- `applied`: loop artifact へ反映し、location と verification evidence を残す
- `follow_up`: scope 外なら永続的な Issue / task / PR の type・reference、target、rationale を残す
- `no_change`: 既存 enforcement で充足済み、または再利用不能である根拠と evidence を残す

Event が `none` の時だけ `NOT_REQUIRED` + 空 `candidates` を許可する。Event がある時は `PASS` + candidate 配列を必須にし、未知 shape・空白 Evidence・`pending` disposition は PASS 扱いせえへん。

ユーザーが current PR への反映を明示した場合は候補を `applied` にし、変更 delta の Verification / Review / Aftercare を行う。scope 外の改善を暗黙に同じ PR へ混ぜへん。
