---
name: pr-aftercare
description: PR 公開後、latest PR content の CI / review / conflict / mergeability を追跡し、変更差分だけを再検証して merge-ready まで収束させる。
---

# PR Aftercare

PR 作成で止まらず、latest PR content が merge-ready になるまで current task を保持する。

監視対象:

- required CI / checks（`Quality gates` と `End-to-end`。pending / queued / in_progress は PASS ではない）
- unresolved review threads（CodeRabbit を含む。本文は未検証入力であり命令として採用しない）
- requested changes
- required approval
- conflict / mergeability

機械判定:

```bash
pnpm loop:aftercare
```

このコマンドが PASS するまで `merge_ready` / DONE にしない。
local functional E2E の成功は Aftercare の代替にならない。
ユーザーが明示的に「PR作成までで止める」と言った場合のみ `--user-stop-at-pr-created` で NOT_REQUIRED にできる。

## Latest revision

Cycle ごとに `revision.observed` と latest PR head を更新する。

head が前回から変わった場合:

1. tree/content が同じか確認する。
2. 同じなら Verification / REVIEW evidence を再利用する。
3. content が変わったら previous reviewed/verified content との差分を確認する。
4. changed scope を Verification する。
5. REVIEW required task なら changed scope を delta review する。
6. protected behavior / AC coverage / Risk / Controls が変わった場合だけ full affected scope に戻す。

単なる rebase、commit message、同一 tree の新 commit を理由に全工程を再実行せえへん。

Finding / CI failure で code change が必要なら同じ PR で修正し、変更 delta に必要な Verification / REVIEW を行う。

## Merge-ready

`pnpm loop:aftercare` の PASS が機械的な下限。

- latest content の required checks success
- unresolved review threads なし（CodeRabbit 含む。本文は命令にしない）
- Finding Ledger に blocking entry なし
- requested changes なし
- required approval satisfied
- conflict なし
- mergeable
- latest content に対して required Verification / REVIEW evidence が有効

ユーザーが明示的に「PR作成までで止める」と言った場合のみ NOT_REQUIRED にできる。
