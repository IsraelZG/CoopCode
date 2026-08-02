---
{
  "id": "DEVX-020",
  "title": "Finish the node:path.join-on-Windows cluster: repo-detection fallback, ai-vault RPC, dead markdown-discovery module, CI script",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/git/repo.ts",
    "apps/desktop/orca/src/main/git/repo-detection.test.ts",
    "apps/desktop/orca/src/main/runtime/rpc/methods/ai-vault.ts",
    "apps/desktop/orca/src/main/runtime/rpc/methods/ai-vault.test.ts",
    "apps/desktop/orca/src/shared/node-markdown-document-discovery.ts",
    "apps/desktop/orca/src/shared/node-markdown-document-discovery.test.ts",
    "apps/desktop/orca/config/scripts/pr-workflow-parallelism.test.mjs",
    "docs/planning/evidence/DEVX-020-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-020.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-020-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/git/repo-detection.test.ts src/main/runtime/rpc/methods/ai-vault.test.ts src/shared/node-markdown-document-discovery.test.ts config/scripts/pr-workflow-parallelism.test.mjs",
      "purpose": "Run this task's four affected test files, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-020 · Finish the remaining node:path.join-on-Windows instances

## Outcome

The four remaining instances of the `node:path.join`-emits-backslashes
pattern that `DEVX-016` deliberately left as follow-up are fixed or, for the
dead-code case, either fixed or explicitly retired. `DEVX-016` covered the
two production-breaking cases (Codex resume, worktree file-watch); this task
closes the rest of the same cluster so it stops being a recurring line item
in every future suite triage.

## Acceptance

- [ ] `repo-detection.test.ts`'s "when Git is unavailable" fallback in
      `src/main/git/repo.ts`'s `getGitRepoRoot` returns a path in the same
      separator flavor native path consumers on this platform expect,
      instead of the forward-slash form it returns today when falling back.
- [ ] `ai-vault.test.ts`'s `additionalCodexSessionsDirs` assertion in
      `src/main/runtime/rpc/methods/ai-vault.ts` produces a forward-slash
      path matching the test's expectation, using the project's
      `src/shared/cross-platform-path.ts` helpers rather than a new local
      fix.
- [ ] `src/shared/node-markdown-document-discovery.ts` is confirmed to have
      no importers outside its own test (re-verify with a fresh `grep`, do
      not trust the prior triage's finding blindly) and then either: (a)
      fixed the same way as the other two entries above, since it is real
      latent behavior that will resurface the moment something imports it,
      or (b) if the worker judges it truly dead and unlikely to be wired up,
      say so plainly in the report and fix it anyway — this is a two-test
      module, fixing it costs less than continuing to carry it as a known
      failure forever.
- [ ] `pr-workflow-parallelism.test.mjs`'s "keeps every real-zsh test in the
      dedicated shell lane" assertion passes by normalizing discovered paths
      to `/` before comparing against the hardcoded forward-slash expected
      list, or by comparing through a path-flavor-neutral helper — worker's
      choice, since this is a CI tooling script, not shipped product code.
- [ ] All four test files pass, and no previously-passing test in them
      breaks. State the before/after failing counts (per `DEVX-013`'s
      triage: 2 in `repo-detection.test.ts`, 2 in `ai-vault.test.ts`, 2 in
      `node-markdown-document-discovery.test.ts`, 1 in
      `pr-workflow-parallelism.test.mjs`).

## Non-goals

- Do not touch `codex-session-resume-home.ts`,
  `worktree-base-directory-event-filter.ts`, or
  `worktree-base-directory-watcher.ts` — those are `DEVX-016`, already
  closed. Do not re-verify or re-fix them here.
- Do not do a repo-wide audit for other, not-yet-triaged `node:path` call
  sites. Scope is exactly the four files in `scope.allow`.
- Do not add a lint rule banning `node:path.join` on logical/POSIX-style
  values. That is a much larger, separate decision (would need to distinguish
  legitimate native-path joins from logical-path joins repo-wide) and is not
  needed to close these four instances.
- Do not change POSIX/macOS/Linux behavior of any of these four files — the
  bug is Windows-only.

## Sources and decisions

- `docs/planning/evidence/DEVX-013-triage.md` — all four findings, and the
  explicit statement that `node-markdown-document-discovery.ts` is not
  imported anywhere outside its own test as of 2026-07-31.
- `docs/coop/tasks/DEVX-016.md` — the sibling task that fixed the two
  production-breaking instances of this same cluster and named these four as
  its own follow-up, using the same `cross-platform-path.ts` helpers.
- `apps/desktop/orca/src/shared/cross-platform-path.ts` — the existing fix
  direction (`normalizeRuntimePathForComparison`, `resolveRuntimePath`,
  `normalizeRuntimePathSeparators`), already confirmed to exist.
- `docs/planning/evidence/BASELINE.md` — compare against it, not green.

## Plan and test mapping

1. Re-run the four test files to reproduce; re-confirm the
   `node-markdown-document-discovery.ts` dead-code claim independently.
2. Fix `repo.ts`'s git-unavailable fallback. Criterion 1.
3. Fix `ai-vault.ts`'s session-dirs path construction. Criterion 2.
4. Fix (or, per the worker's judgment, retire) `node-markdown-document-discovery.ts`.
   Criterion 3.
5. Fix `pr-workflow-parallelism.test.mjs`'s path comparison. Criterion 4.
6. Run all four together, confirm no regression. Capture before/after counts
   as hands-on evidence. Criterion 5.
7. Write `docs/planning/evidence/DEVX-020-gate.json` per
   `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Closing
this task, together with `DEVX-016`, retires the entire `node:path.join`
 cluster the DEVX-013 triage found — no further follow-up should remain from
 it afterward.

## Integration

- Review decision: `accept`
- Result SHA: `0e1cb4df6e3dae14150c7ce42a56a93d803a8863`
- Merge commit: `a553eefe8`
- Gate: task/Gate Artifact validators and 58 focused tests (`exit 0`).
