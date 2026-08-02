---
{
  "id": "DEVX-042",
  "title": "Rank every task that needs a human decision into one attention view, instead of re-reading every task and log by hand",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-040"],
  "blocked_on": ["DEVX-040"],
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
