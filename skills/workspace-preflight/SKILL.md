---
name: workspace-preflight
description: local repository を変更する PREPARE で使う軽量 helper。独立した直列 Gate ではない。
---

# Workspace Preflight helper

通常の code / config / migration / agent-process 変更は、`main` を直接編集せず task branch / worktree で行う。

Local checkout を編集する場合だけ、PREPARE の一部として最低限確認する。

```bash
git rev-parse --show-toplevel
git branch --show-current
git status --short
git worktree list
```

必要条件:

- branch が `main` ではない
- detached HEAD ではない
- baseline が clean、または既存差分の ownership が明確
- task identity が Issue / user request と一致する
- 他 task の差分を混ぜない

必要なら例:

```bash
git worktree add ../re-me-<task> -b agent/<task> main
```

既存差分を勝手に reset / stash / delete しない。

GitHub connector のように既に専用 branch へ直接変更する場合は、同等条件を branch / base ref の確認で満たせばよく、ローカル command packet を作る必要はない。

`docs/` / README だけの純粋な文書変更は、理由を記録して local worktree preflight を省略してよい。`AGENTS.md`、`.loop/`、`skills/`、migration、CI、設定ファイルは pure docs 扱いにしない。
