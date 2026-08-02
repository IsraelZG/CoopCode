---
{
  "id": "DEVX-040",
  "title": "Render the task/spec lifecycle board from git, with real worktree detection instead of trusting frontmatter state alone",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-002", "DEVX-003", "DEVX-014"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ipc/coop-board.ts",
    "apps/desktop/orca/src/main/ipc/coop-board.test.ts",
    "apps/desktop/orca/src/preload/index.ts",
    "apps/desktop/orca/src/preload/api-types.ts",
    "apps/desktop/orca/src/renderer/src/components/coop-board/**",
    "apps/desktop/orca/src/renderer/src/App.tsx",
    "docs/planning/evidence/DEVX-040-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-040.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-040-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-board.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-040 · The task board reads git, and checks reality before trusting a label

## Outcome

CoopCode has its own read-only screen showing every task's real lifecycle
state (`draft`/`ready`/`working`/`review`/`done`) and what, if anything, is
blocking it — sourced from the Task Specs versioned in git, per wayfinder
ticket 14's resolution, not from Orca's `OrchestrationDb` (a different
problem: live PTY-backed agent execution, not this project's attempt/gate/
review cycle). The existing agent Kanban (`AgentKanbanBoard.tsx`,
`dashboard-snapshot.ts`) is untouched — this is a separate screen for a
separate question.

The concrete reason this needs its own detection logic, not just a frontmatter
read: `DEVX-024`'s task file sat at `state: "ready"` in git for the entire
~28 minutes its chunk-runner actually ran and dispatched real work in
`C:\Dev2026\worktrees\CoopCode\DEVX-024` — the frontmatter was never updated
to `working`, and nothing in the Coop lifecycle enforces that it is. A board
that only reads frontmatter would have shown that task as untouched while it
was, in fact, live. This task fixes the board side of that gap by checking
for a real worktree/branch, not by trying to force workers to remember a
manual status flip.

## Acceptance

- [ ] A main-process module parses every `docs/coop/tasks/*.md` file in a
      given repo root (configurable, not hardcoded to `agentic-ide` — the
      convention is repo-agnostic): frontmatter (`state`, `priority`, `risk`,
      `depends_on`, `blocked_on`) and the trailing `## Integration` section
      when present (`Review decision`, `Result SHA`, `Merge commit`).
- [ ] For any task whose frontmatter is not `done`, the module additionally
      checks whether a git worktree/branch matching the `task/<id-lowercase>`
      pattern exists (the exact convention `tools/coop-dev/prepare-task.mjs`
      creates) and reports the task as `working` when one does, regardless of
      what the frontmatter says. Proven against this repo: pointed at
      `agentic-ide` at a moment when a `task/devx-0NN` worktree genuinely
      exists, the board must classify that task `working`, not `ready`.
- [ ] Blocking is computed, not echoed raw: a task listing a `depends_on` ID
      whose own state (by the same computation, recursively) is not `done`
      is marked blocked, naming which dependency is unmet — not a bare
      `blocked: true`.
- [ ] A new renderer screen under
      `src/renderer/src/components/coop-board/` (following `DEVX-014`'s IPC
      + preload + shadcn/`STYLEGUIDE.md` convention) lists every task with
      its computed state, blocking reason if any, and worktree path when
      live. Wired into `App.tsx` the same way the opencode-sessions screen
      already is.
- [ ] Hands-on evidence: a screenshot of the screen run against this repo's
      real `docs/coop/tasks/`, showing at least one `done` task, one
      dependency-blocked task, and one task correctly read as `working` via
      worktree detection (or, if none is live at review time, a fixture-
      backed test proving the same detection logic, with the gap noted, not
      silently skipped).

## Non-goals

- Do not replace, modify, or read from `AgentKanbanBoard.tsx` or
  `dashboard-snapshot.ts` — that surface answers "what is an agent doing
  right now"; this task answers "what state is a task spec in and why."
  Ticket 14 keeps them separate on purpose.
- Read-only. No dispatch, rework, close, or any write action from this
  screen — that is explicitly later work (`DEVX-042` and beyond), once this
  read model is proven and trusted.
- Do not add a database, cache, or new storage layer. Read git directly, on
  demand — the same choice ticket 14 already made and this task inherits.
- Do not support task-spec conventions other than this project's
  `task-spec-v1` shape. A repo using a different task format is out of
  scope.
- Do not attempt multi-machine or remote-worktree detection. Local
  `git worktree list` on the machine CoopCode runs on is enough for this
  slice.

## Sources and decisions

- `.scratch/wayfinder/issues/14-task-board-data-source-decision.md` —
  resolved 2026-07-31: CoopCode's own event log from git Task Specs, not
  `OrchestrationDb`; applies to this task by name.
- `docs/coop/task-spec-v1.md` / `docs/coop/schemas/task-spec-v1.schema.json`
  (`DEVX-002`) — the frontmatter shape this task parses.
- `docs/coop/gate-artifact-v1.md` (`DEVX-003`) — the `## Integration` section
  shape (`Review decision`, `Result SHA`, `Merge commit`) already used by
  every closed `DEVX-*` task in this repo.
- `apps/desktop/orca/src/main/ipc/opencode-sdk.ts` and
  `src/renderer/src/components/opencode-sessions/` (`DEVX-014`) — the IPC +
  preload + renderer convention this task follows for a new domain screen.
- `tools/coop-dev/prepare-task.mjs` — the exact `task/<id-lowercase>` branch
  and `<worktreeRoot>/<ID>` path convention this task's worktree-detection
  logic must match, not reinvent.
- Observed directly 2026-08-02: `docs/coop/tasks/DEVX-024.md` stayed
  `state: "ready"` throughout a real, dispatched ~28-minute chunk-runner run
  in `C:\Dev2026\worktrees\CoopCode\DEVX-024` — concrete proof frontmatter
  alone is an unreliable "is this being worked on" signal, and the direct
  motivation for this task's worktree-detection criterion.
- The development roadmap (`docs/coop/development-roadmap.md`) lists this
  task's dependency as `DEVX-023`; that dependency does not hold up under
  inspection — a task-lifecycle board built from Task Specs and Gate
  Artifacts has no technical need for the corpus-learning extractor. The
  real prerequisites are the Task Spec and Gate Artifact contracts
  themselves (`DEVX-002`/`DEVX-003`, both done) plus the UI convention
  (`DEVX-014`, done) — recorded here as a correction, not silently changed.

## Plan and test mapping

1. Write the main-process parser for frontmatter + `## Integration`, with a
   fixture-backed unit test (small fake task files, not this repo's real
   ones, so the test doesn't depend on this repo's changing state).
   Criterion 1.
2. Add worktree/branch detection via `git worktree list --porcelain`, wired
   to override frontmatter state. Criterion 2.
3. Implement recursive blocking computation over `depends_on`. Criterion 3.
4. Build the renderer screen and wire it into `App.tsx`. Criterion 4.
5. Capture hands-on evidence against this repo's real state. Criterion 5.
6. Run the declared gates and write `docs/planning/evidence/DEVX-040-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This task
closing means the read model is real and trustworthy — `DEVX-041` and
`DEVX-042` build screens and filters on top of it, and neither should need to
re-derive task state from scratch.
