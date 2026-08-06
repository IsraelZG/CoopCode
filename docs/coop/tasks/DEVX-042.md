---
{
  "id": "DEVX-042",
  "title": "Rank every task that needs a human decision into one attention view, instead of re-reading every task and log by hand",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-040"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ipc/coop-board.ts",
    "apps/desktop/orca/src/main/ipc/coop-board.test.ts",
    "apps/desktop/orca/src/renderer/src/components/coop-board/**",
    "docs/planning/evidence/DEVX-042-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-042.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-042-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-board.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-042 · One screen for everything waiting on a human

## Outcome

Opening CoopCode after time away shows one ranked list of every task that
genuinely needs a human decision — blocked on an unmet dependency with no
path forward, closed with a `rework`/`blocked` review verdict not yet
re-attempted, or halted by a stop condition that was not a clean full-quota
finish — instead of requiring a human to open every task file and every
`*-loop-log.md` by hand to find out the same thing. This is a filtered,
ranked view over `DEVX-040`'s read model, not a new data source.

## Acceptance

- [ ] Compute an "attention" subset from `DEVX-040`'s task list: tasks with
      an unmet `blocked_on` entry, tasks whose most recent `## Integration`
      section records `Review decision: rework` or `blocked` with no newer
      attempt superseding it, and tasks with a `Stop:` line in any
      `docs/planning/evidence/<ID>*-log.md` file whose recorded reason is
      not a clean, fully-completed run (e.g. `budget_exhausted` after
      reaching its own declared `max_tasks`/chunk ceiling counts as clean;
      `repeated_failure`, `scope_escape`, or `secret_encountered` do not).
- [ ] Each attention item is ranked: `risk: "high"` before `risk: "routine"`,
      then `priority` (`P0` before `P1` before `P2`), then most recently
      stalled first within a tier.
- [ ] Renders as a filter/tab on `DEVX-040`'s existing screen — not a
      separate app or window.
- [ ] Each item states why it needs attention in one line (reusing
      `DEVX-040`'s blocking-reason computation where applicable) — never a
      bare "needs review" with no reason given.
- [ ] Hands-on evidence: run against this repo's real state at review time
      and correctly surface at least one genuinely attention-needing task
      (a real `rework`/`blocked` verdict, a real unmet dependency, or a real
      non-clean stop condition already present in this repo) — not only a
      fixture case.

## Non-goals

- No notifications, email, or OS-level alerts. This is a screen a human
  opens; it does not push anything.
- No auto-remediation, auto-retry, or auto-dispatch from this view. Read and
  rank only — acting on an attention item is a human opening the relevant
  worker/reviewer session themselves, same as today.
- No cross-repo or cross-machine aggregation. Local repo only, matching
  `DEVX-040`'s scope.
- Do not change `docs/coop/policies/development-budget-v1.json`'s
  stop-condition semantics or `DEVX-024`'s loop-log format. This task only
  reads and interprets what already exists.
- Do not build `DEVX-041`'s evidence-linking here, even though both extend
  the same board — keep the two reviewable and testable independently.

## Sources and decisions

- `DEVX-040` — the board and read model this task filters; does not start
  until that task is `done`.
- Loop-log `Stop:` line format, observed directly 2026-08-02 in
  `docs/planning/evidence/DEVX-024-loop-log.md`: `Stop: budget_exhausted —
  max_tasks=10 reached (10 dispatches)` — a clean, fully-completed stop. The
  same field distinguishes a clean ceiling-reached stop from a genuine
  failure stop (`repeated_failure`, `scope_escape`, `secret_encountered`),
  which is the exact distinction this task's ranking needs.
- `docs/coop/policies/development-budget-v1.json` — the stop-condition
  vocabulary (`secret_encountered`, `scope_escape`, `repeated_failure`,
  `budget_exhausted`) this task classifies against, without altering it.
- The development roadmap listed this task's dependency as `DEVX-023`; that
  does not hold up under inspection either — an attention inbox filters
  `DEVX-040`'s task/board data, which has no technical link to the
  corpus-learning extractor. Recorded here as a correction, matching the
  same fix already made in `DEVX-040`'s own Sources section.

## Plan and test mapping

1. Implement the attention-subset computation over `DEVX-040`'s read model
   plus loop-log `Stop:` line parsing, with fixture-backed tests for each of
   the three attention categories. Criterion 1.
2. Implement ranking. Criterion 2.
3. Add the filter/tab to the existing board screen. Criterion 3.
4. Implement the one-line reason string per item. Criterion 4.
5. Capture hands-on evidence against this repo's real state. Criterion 5.
6. Run the declared gates and write `docs/planning/evidence/DEVX-042-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
a human never needing to open a task file or a loop log just to find out
something is waiting on them — the screen already says so and why.

## Review (attempt 1)

- Reviewer: Crush (MiniMax-M3), acting as $coop-reviewer
- Date: 2026-08-06
- Result SHA reviewed: `8fb977aba53521f7f9bc616210e7ec7be95d2faf`
- Base SHA: `0d4e64bd47df8967f0fe8822bc6607c07c5e9666`
- Decision: `rework`
- Scope check: all 4 changed files (`coop-board.ts`, `coop-board.test.ts`,
  `CoopBoardScreen.tsx`, `DEVX-042-gate.json`) are inside `scope.allow`. Pass.
- Gate SHA binding: trailing commit `7f6c9e383` only touches the task's own
  `DEVX-042-gate.json`; deliverable commit `8fb977aba` touches no evidence
  files. Valid per `docs/coop/gate-artifact-v1.md` "Vinculação do resultSha".
  `validate-gate-artifact.mjs` returns VALID.
- `validate-task.mjs` returns `OK: DEVX-042 (ready, standard, 5 criteria)`.
- `pnpm exec vitest run src/main/ipc/coop-board.test.ts` → 1 file, 7 tests,
  all pass (gate-stdout reproduced; see gate artifact gate #3).

### Findings

- MAJOR — criterion 5 unmet as provable against this repo's real state —
  the gate artifact's claim "Verified loadCoopBoard execution and unit test
  suite over real and fixture task specifications" overstates what was
  demonstrated. I re-implemented the same `computeAttention` +
  `loadLoopLogMap` algorithm and ran it against the live repo at
  `C:/Dev2026/worktrees/CoopCode/DEVX-042` (the same path the worker used).
  Result: 0 attention items, 0 loop-log files, 0 rework/blocked review
  decisions in any task file. The only "blocked" task the read model
  surfaces is `DEVX-001` (depends on missing `PLAT-013`), but its
  `state: done` correctly bypasses attention, so it is not surfaced either.
  All currently `ready` tasks (`DEVX-024/041/042/045/046/047/048/049`) have
  their `depends_on` entries already `done` (the prior "unblock
  DEVX-024/041/042/048" integration commit
  `5aeac73d7 unblock DEVX-024, DEVX-041, DEVX-042, DEVX-048: their
  blocked_on dependencies are done` is part of the worker's own base), so
  there is no genuine unmet dependency to surface. The criterion reads
  "correctly surface at least one genuinely attention-needing task … —
  not only a fixture case." That bar is not met by the worker's
  fixture-backed `coop-board.test.ts` alone. Required outcome: either (a)
  the worker records a real-repo probe that proves at least one attention
  item surfaces (which requires re-introducing a real rework/blocked
  verdict, a real unmet dependency, or a real non-clean loop log into the
  repo) and updates the gate's criterion-5 detail accordingly, or (b) the
  spec itself is amended by the dispatcher to relax the "not only a
  fixture case" requirement (out of scope for this worker).
  Evidence: `tmp-probe-board.mjs` (now removed) ran the same algorithm
  against the real repo and printed `Attention needed: 0`,
  `Loop logs found: 0`. criterion: #5.

- INFO — criterion 1 implementation is correct and complete. Three
  categories (`blocked`, `rework`, `loop_stop`) with a clean/dirty
  distinction on the loop-log `Stop:` line that matches the spec's
  "budget_exhausted … max_tasks/ceiling" clean / "repeated_failure,
  scope_escape, secret_encountered" non-clean split (via a substring
  check on `budget_exhausted` AND `max_tasks|ceiling`; see
  `parseStopLine` at `apps/desktop/orca/src/main/ipc/coop-board.ts:232`).
  One small spec note: the `reviewDecision === 'blocked'` match treats the
  literal verdict word `blocked` (lowercased) as a rework category.
  Spec text says `Review decision: rework` or `blocked`, so this is
  consistent — but worth a glance from the dispatcher in case
  `integration.reviewDecision: "blocked"` was intended only as a synonym
  for "blocked-by-someone" and the task spec means something else.
- INFO — criterion 2 ranking is correctly risk → priority → stalledAt
  descending → id numeric tiebreaker; same algorithm in both
  `coop-board.ts:350` (exported `compareAttentionTasks`, unit-tested) and
  `CoopBoardScreen.tsx:42` (`sortAttentionTasks` for the renderer
  side). Unit test covers the four-tiebreak ordering correctly.
- INFO — criterion 3 satisfied. Filter/tab added inline above the table
  on the existing `CoopBoardScreen` (not a new screen or window), with
  "All Tasks (N)" and "Needs Attention (N)" buttons, plus an
  "No tasks currently require human attention" empty state for the
  attention filter (`CoopBoardScreen.tsx:253-267`).
- INFO — criterion 4 satisfied. The reason string format
  `Blocked by <reasons>`, `Review decision: <verdict>`, and
  `Loop stopped: <stopLine>` is shown in destructive-tone text on the
  task row (`CoopBoardScreen.tsx:86-89`), pre-empts the prior
  `Blocked by …` subtitle when the task is in the attention subset, and
  is never a bare "needs review".

### Required to accept

Resolve the MAJOR finding above: re-run the live probe with at least one
real attention item present in this repo, or have the dispatcher amend
criterion 5 to be satisfiable against a repo that currently has none. The
algorithm, tests, scope, and gate SHA binding are otherwise clean and
require no rework.

