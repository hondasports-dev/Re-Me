---
name: workspace-preflight
description: repository 変更を task branch / worktree と clean baseline から開始するための事前確認。最初の編集前に使う。
---

# Workspace Preflight

## 原則

通常の code / config / migration / agent-process 変更は、`main` を直接編集せず task branch / worktree で行う。

編集前に最低限確認する。

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short
git worktree list
```

PASS 条件:

- branch が `main` ではない
- detached HEAD ではない
- baseline が clean
- task identity が Issue / user request と一致する
- 既存の他 task 差分を含まない

必要なら例:

```bash
git worktree add ../re-me-<task> -b agent/<task> main
```

既存差分を勝手に reset / stash / delete しない。

`docs/` / README だけの純粋な文書変更は、理由を記録して worktree preflight を省略してよい。`AGENTS.md`、`.loop/`、`skills/`、migration、CI、設定ファイルは pure docs 扱いにしない。
