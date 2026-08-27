import { describe, expect, it } from "vitest";
import {
  evaluateWorkspaceState,
  isDocumentationOnlyPath,
  parseWorktreeList,
  stagedFilesRequireIsolation,
} from "./check-task-worktree.mjs";

describe("check-task-worktree", () => {
  it("parses registered worktrees", () => {
    const entries = parseWorktreeList(
      "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo-task\nHEAD def\nbranch refs/heads/agent/task\n",
    );
    expect(entries).toEqual([
      { path: "/repo", branch: "main", detached: false },
      { path: "/repo-task", branch: "agent/task", detached: false },
    ]);
  });

  it("rejects main as a task branch", () => {
    const result = evaluateWorkspaceState({
      branch: "main",
      currentPath: "/repo-task",
      canonicalPath: "/repo",
      registered: true,
      dirty: false,
      requireClean: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("protected base branch 'main' is not a task branch");
  });

  it("allows a clean isolated task worktree", () => {
    const result = evaluateWorkspaceState({
      branch: "agent/task",
      currentPath: "/repo-task",
      canonicalPath: "/repo",
      registered: true,
      dirty: false,
      requireClean: true,
    });
    expect(result).toEqual({ ok: true, errors: [], baseline: "CLEAN" });
  });

  it("rejects the canonical worktree", () => {
    const result = evaluateWorkspaceState({
      branch: "agent/task",
      currentPath: "/repo",
      canonicalPath: "/repo",
      registered: true,
      dirty: false,
      requireClean: false,
    });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("current directory is the canonical worktree");
  });

  it("rejects a dirty baseline when require-clean is enabled", () => {
    const result = evaluateWorkspaceState({
      branch: "agent/task",
      currentPath: "/repo-task",
      canonicalPath: "/repo",
      registered: true,
      dirty: true,
      requireClean: true,
    });
    expect(result.ok).toBe(false);
  });

  it("treats only docs, README and CHANGELOG as documentation-only", () => {
    expect(isDocumentationOnlyPath("docs/process.md")).toBe(true);
    expect(isDocumentationOnlyPath("README.md")).toBe(true);
    expect(isDocumentationOnlyPath("AGENTS.md")).toBe(false);
    expect(isDocumentationOnlyPath(".loop/process.yaml")).toBe(false);
    expect(isDocumentationOnlyPath("skills/verification/SKILL.md")).toBe(false);
  });

  it("requires isolation when staged files include loop policy", () => {
    expect(stagedFilesRequireIsolation(["docs/a.md", "AGENTS.md"])).toBe(true);
    expect(stagedFilesRequireIsolation(["docs/a.md", "README.md"])).toBe(false);
  });
});
