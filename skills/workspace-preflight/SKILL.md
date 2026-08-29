---
name: workspace-preflight
description: local repository を変更する PREPARE で使う軽量 helper。独立した直列 Gate ではない。
---

# Workspace Preflight helper

通常の code / config / migration / agent-process 変更は、`main` を直接編集せず task branch / worktree で行う。

Local checkout を編集する場合、PREPARE の一部として次を実行する。

```bash
pnpm loop:preflight
```

内部では次を実行する。

```bash
node scripts/check-task-worktree.mjs --require-clean
```

canonical `.env.local` から `E2E_AUTH0_*` を現在の worktree へ同期する。値は表示・commit しない。既存キーは上書きしない。資格情報不足は PREPARE では止めず、画面変更時は `pnpm loop:e2e-gate` で BLOCK する。Convex CLI login と local deployment はこの同期の対象外。新しい worktree で `pnpm convex:check` が必要なときは `docs/development/preview-environment.md` の「Task worktree の local Convex」に従う。cloud の `CONVEX_DEPLOYMENT` を worktree の正本にコピーしない。

PASS 条件:

- branch が `main` ではない
- detached HEAD ではない
- canonical worktree とは別の登録済み task worktree
- baseline が clean
- task identity が Issue / user request と一致する
- 他 task の差分を混ぜない

必要なら例:

```bash
git worktree add ../re-me-<task> -b agent/<task> main
```

既存差分を勝手に reset / stash / delete しない。

GitHub connector のように repository API 経由で専用 branch へ直接変更する場合は、local worktree scriptを無理に実行しない。代わりに次を同等 Evidence とする。

- base ref が `main`
- write先が `main` ではない専用 task branch
- branch が current task 専用である
- 変更前のbase/head identityを記録する

`docs/` / README / CHANGELOG だけの純粋な文書変更は、理由を記録して local worktree preflight を省略してよい。`AGENTS.md`、`.loop/`、`skills/`、`scripts/`、migration、CI、設定ファイルは pure docs 扱いにしない。

## Deterministic test

Workspace Preflightルール自体を変更した場合は次を実行する。

```bash
pnpm test:loop
```
