---
{
  "id": "DEVX-016",
  "title": "Fix the node:path.join separator bug that silently breaks Codex resume and worktree file-watch on Windows",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/codex/codex-session-resume-home.ts",
    "apps/desktop/orca/src/main/ipc/worktree-base-directory-event-filter.ts",
    "apps/desktop/orca/src/main/ipc/worktree-base-directory-watcher.ts",
    "apps/desktop/orca/src/main/codex/codex-session-resume-home.test.ts",
    "apps/desktop/orca/src/main/codex/codex-session-resume-preparation.test.ts",
    "apps/desktop/orca/src/main/ipc/worktree-base-directory-event-filter.test.ts",
    "apps/desktop/orca/src/main/ipc/worktree-base-directory-watcher.test.ts",
    "docs/planning/evidence/DEVX-016-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-016.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-016-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/codex/codex-session-resume-home.test.ts src/main/codex/codex-session-resume-preparation.test.ts src/main/ipc/worktree-base-directory-event-filter.test.ts src/main/ipc/worktree-base-directory-watcher.test.ts",
      "purpose": "Run this task's four affected test files, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-016 · Fix the path-separator bug breaking real features on Windows

## Outcome

Two real features stop failing silently on Windows 11 ARM64 — the project's
own reference platform per `docs/adr/0001-platform-priority.md`: Codex session
resume finds its sessions again, and worktree git-state file-watch
classification classifies again.

The failure mode is what makes this urgent: nothing throws. A logical,
POSIX-style path is combined with `node:path`'s platform-native `join`, which
emits backslashes on Windows; the later string comparison against the original
forward-slash value just doesn't match, and the code returns `null` or an
empty set. A user sees a feature quietly not work, with no error anywhere.

## Acceptance

- [ ] `resolveTrustedCodexSessionResumeHome` / `findTrustedCodexSessionResume`
      return the expected home instead of `null` for a POSIX-style recorded
      home (e.g. `/managed/account/home`) while running on Windows. Root
      cause is `join(homePath, 'sessions')` at
      `src/main/codex/codex-session-resume-home.ts:68` and `:231` — the file
      imports `join` from `node:path` at line 2.
- [ ] `matchingWorktreeBaseRepoIds` returns populated
      `structureRepoIds`/`gitStatusRepoIds`/`headIdentityRepoIds` for inputs
      that should classify, and the watcher no longer fails poller lookups
      with `No poller callback for \workspace\worktrees` (root keyed with the
      wrong separator).
- [ ] The fix routes through the project's existing helpers in
      `src/shared/cross-platform-path.ts` (`normalizeRuntimePathForComparison`,
      `resolveRuntimePath`, `normalizeRuntimePathSeparators`) rather than a
      new local normalizer or a scattering of `.replace(/\\/g, '/')` calls.
      If a needed helper genuinely does not exist, adding one there is fine —
      say so in the report.
- [ ] All four test files in the gate pass, and the previously-passing tests
      in them still pass. State the before/after failing counts (the DEVX-013
      triage recorded 9 failures in `codex-session-resume-home.test.ts`,
      2 in `codex-session-resume-preparation.test.ts`, 5 in
      `worktree-base-directory-event-filter.test.ts`, 15 in
      `worktree-base-directory-watcher.test.ts`).
- [ ] Hands-on evidence on Windows 11 ARM64: show the resolution working for
      a POSIX-style home, not just a green test line.

## Non-goals

- Do not attempt the whole `node:path` cluster. The other instances the
  triage found are explicitly out of scope here: `repo-detection.ts`'s
  git-unavailable fallback, `src/main/runtime/rpc/methods/ai-vault.ts`,
  `node-markdown-document-discovery.ts` (dead code — nothing imports it
  outside its own test), and `config/scripts/pr-workflow-parallelism.mjs`
  (CI tooling, not shipped). Record them as remaining follow-ups.
- Do not fix `pty.test.ts` or `pty-subprocess.test.ts` directly. The triage
  found both are downstream symptoms of the Codex home resolution above; if
  they go green as a side effect, say so, but they are not in scope and their
  files are not in `scope.allow`.
- Do not do a repo-wide `node:path` audit or codemod. That is a separate,
  larger task and this one must stay verifiable.
- Do not change the POSIX behavior of any of these modules. The bug is
  Windows-only; macOS/Linux must be untouched.

## Sources and decisions

- `docs/planning/evidence/DEVX-013-triage.md` — the cluster finding, and its
  judgment that `worktree-base-directory-event-filter.ts` is the
  highest-severity instance while `codex-session-resume-home.ts` breaks the
  most user-visible feature. Both are covered here for that reason.
- Verified directly on 2026-07-31, not taken on trust:
  `codex-session-resume-home.ts:2` imports `join` from `node:path`, used at
  `:68` and `:231` as `join(homePath, 'sessions')`.
- `src/shared/cross-platform-path.ts` exists and already exports
  `isWindowsAbsolutePathLike`, `normalizeRuntimePathSeparators`,
  `normalizeRuntimePathForComparison`, `isRuntimePathAbsolute`,
  `resolveRuntimePath`, `getRuntimePathBasename` — the fix direction is
  available, not hypothetical.
- `docs/adr/0001-platform-priority.md` — Windows 11 ARM64 is the first
  development and release gate, which is why a Windows-only silent breakage
  is P1 rather than a portability nicety.
- `apps/desktop/orca/AGENTS.md` — cross-platform rules; also the SSH and
  folder-workspace cases, both relevant since the logical paths involved come
  from SSH-managed homes and virtual roots.
- `docs/planning/evidence/BASELINE.md` — compare against it, not against
  green; the suite is red before this change.

## Plan and test mapping

1. Run the four test files to reproduce, and record the exact before-counts.
2. Fix the Codex home resolution using the `cross-platform-path` helpers;
   confirm `codex-session-resume-home.test.ts` and the preparation test.
   Criteria 1 and 3.
3. Fix the worktree base-directory filter/watcher the same way; confirm both
   test files. Criteria 2 and 3.
4. Re-run all four together, confirm no previously-passing test broke.
   Criterion 4.
5. Capture hands-on evidence and write
   `docs/planning/evidence/DEVX-016-gate.json` per
   `docs/coop/gate-artifact-v1.md`. Criterion 5.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. The
remaining `node:path` instances stay open as follow-ups; closing this task
does not claim the cluster is gone, only that the two production-breaking
root causes are fixed.
