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

## Review (attempt 1)

- Reviewer: claude-sonnet-5
- Date: 2026-08-04
- Result SHA reviewed: `f81bbef1f87b0b01a953b3bbbf40f73daa311f6f`
- Decision: `rework`
- Findings:
  - BLOCKER — `apps/desktop/orca/src/main/ipc/register-core-handlers.ts` (and `src/main/index.ts:1177`, the sole call site of `registerCoreHandlers`) — `registerCoopBoardHandlers()` (defined in `coop-board.ts:232`, calls `ipcMain.handle('coopBoard:listTasks', ...)`) is never invoked outside its own unit test — evidence: `git grep -n registerCoopBoardHandlers` across `apps/desktop/orca/src` returns only the definition and `coop-board.test.ts:146`; `register-core-handlers.ts` registers ~20 sibling domain handlers, including `registerOpenCodeSdkHandlers()` at line 148 (the exact convention this task claims to follow), but omits `registerCoopBoardHandlers()` entirely — impact: in the real running app, `CoopBoardScreen.tsx`'s `fetchBoard` calls `window.api.coopBoard.listTasks(...)`, which invokes `ipcRenderer.invoke('coopBoard:listTasks', ...)` against a channel with no registered main-process handler; Electron rejects the call and, since `fetchBoard` has no try/catch, this becomes an unhandled rejection — the screen can never show real data in the shipped app — criterion: 4 (renderer "wired into App.tsx the same way ... opencode-sessions" — true wiring requires a working IPC handler, not just the React import) and 5 (hands-on evidence could not have been captured through the real app with this bug present).
  - MAJOR — no screenshot evidence exists anywhere in the diff or repo (`git diff --name-only 77f03c7c..f81bbef1` between base/result SHA contains zero image files) despite criterion 5 explicitly requiring one, and despite multiple genuinely live task worktrees existing at review time (`git worktree list --porcelain` shows DEVX-013/014/022/027/040/043/044/045/046 live), so the "fixture-backed test ... if none is live at review time" fallback does not apply and no gap was noted anywhere — the gate artifact's own criteria detail claims "Real repo run returned 31 tasks with done, working, blocked states and worktree paths" as if this were UI evidence, but combined with the BLOCKER above, that run could not have gone through the actual rendered screen — criterion: 5.
  - MAJOR — `apps/desktop/orca/src/main/ipc/coop-board.ts:150-159` (`worktreeByTaskId`) hardcodes the branch-match regex to `^refs\/heads\/task\/(devx-\d+)$/i`, but `tools/coop-dev/prepare-task.mjs:60` creates branches generically as `task/${task.id.toLowerCase()}` for any task ID shape (this repo already references non-DEVX IDs, e.g. `PLAT-013` as a dependency in `DEVX-001.md`) — the Sources section explicitly requires matching "the exact ... convention ... not reinvent," and this reinvents a DEVX-only pattern — currently latent (no non-DEVX task files/worktrees exist yet, confirmed via `ls docs/coop/tasks/` and `git worktree list`) but would silently fall back to trusting frontmatter alone for any future non-DEVX task, i.e. exactly the failure mode this task exists to prevent — criterion: 2.
  - MAJOR — `apps/desktop/orca/src/main/ipc/coop-board.ts:118-129` (`getWorktreePorcelain`) uses raw `spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot, ... })`, bypassing the codebase's established git execution layer (`src/main/git/runner.ts`: `gitExecFileAsync`, `gitSpawn`, `wslAwareSpawn`, prompt-guard/non-interactive env helpers) — `coop-board.ts` is the only file under `src/main` (besides its own test) calling `spawnSync(... 'git' ...)` directly (verified by repo-wide grep) — `apps/desktop/orca/AGENTS.md` explicitly requires "All changes must consider the SSH use case. Don't assume local-only execution" and "consider folder workspaces as well as git worktrees," neither of which raw local `spawnSync` honors; it is also synchronous, blocking the Electron main process, unlike the async helpers used elsewhere in `src/main` — criterion: 2.
  - MINOR — `apps/desktop/orca/src/main/ipc/coop-board.ts:157-176` (`computeBlocking`) only inspects each dependency's already-computed `state` one hop away; there is no test covering a multi-level chain (A depends on B depends on C, C not done) to exercise the "recursively" language in criterion 3. Produces truthful per-level reasons in practice but is unverified beyond depth 1 — criterion: 3.
  - INFO — the declared gate 3 command (`tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-board.test.ts`) cannot execute as literally declared in this worktree: `tools/pnpm-arm64.cmd` references a `.toolchains/` directory absent from this checkout, and its repo-root-relative path conflicts with the gate's stated cwd ("from apps/desktop/orca"). This is a pre-existing convention shared identically by ~10 other already-closed DEVX tasks (DEVX-006, 007, 011, 012, 014-020), not introduced by this diff. Independently verified via the locally installed vitest binary instead: 4/4 tests pass, matching the gate artifact's recorded `exitCode: 0`. No action required.

## Review (attempt 2)

- Reviewer: claude-sonnet-5
- Date: 2026-08-05
- Result SHA reviewed: `672be473688571b3427dcc05d02ab4d7e387e38d`
- Decision: `accept`
- Findings:
  - INFO — `apps/desktop/orca/src/main/ipc/register-core-handlers.ts:15` (import) and `:150` (call) now import and call `registerCoopBoardHandlers()` immediately after `registerOpenCodeSdkHandlers()`, matching that sibling's exact pattern — evidence: `git diff` shows only the two added lines; `git grep -n registerCoreHandlers apps/desktop/orca/src/main/index.ts` confirms `registerCoreHandlers(...)` is called at `main/index.ts:1177`, the window-bootstrap call site, so the chain from app startup to `ipcMain.handle('coopBoard:listTasks', ...)` is genuinely live, not just unit-tested — criterion: 4, 5 (attempt-1 BLOCKER resolved).
  - INFO — `apps/desktop/orca/src/main/ipc/coop-board.ts:149` generalized the branch-match regex to `/^refs\/heads\/task\/(.+)$/` (from the old `devx-\d+`-only pattern) with an inline comment citing `prepare-task.mjs`'s generic `task/<id-lowercase>` convention — traced by hand against `refs/heads/task/plat-013`: matches, captures `plat-013`, `.toUpperCase()` yields `PLAT-013` — confirmed by a new test in `coop-board.test.ts` ("classifies any task id shape (not just devx-N)...") that fabricates a `PLAT-013` worktree and asserts `state: 'working'`; this test fails against the pre-rework regex (`devx-\d+`-only) and passes against the current code — genuine regression coverage, not a tautology — criterion: 2 (attempt-1 MAJOR resolved).
  - INFO — `apps/desktop/orca/src/main/ipc/coop-board.ts:4,136` now imports and calls `gitExecFileAsync(['worktree', 'list', '--porcelain'], { cwd: repoRoot })` from `../git/runner`; repo-wide grep inside `coop-board.ts` finds zero remaining `spawnSync`/`spawn`/`execFile` calls; `gitExecFileAsync` (`src/main/git/runner.ts:836`) is genuinely the mandated async layer — SSH/WSL-aware command resolution, non-interactive env, prompt-guard — not a thin wrapper around the same raw call — criterion: 2 (attempt-1 MAJOR resolved).
  - INFO — hands-on screenshot evidence now exists and was inspected directly: `docs/planning/evidence/DEVX-040-board.png` (viewed in full) shows a real rendered `CoopBoardScreen` against `C:\Dev2026\agentic-ide`'s actual `docs/coop/tasks/`, with a `Done` count of 24 (e.g. DEVX-001..DEVX-023 shown with review/merge metadata), a dependency-blocked task (DEVX-001 "Blocked by Missing dependency PLAT-013"), and multiple tasks correctly read as `Working` via live worktree paths (e.g. DEVX-040 itself, frontmatter presumably `ready`, shown `Working` with `C:/Dev2026/worktrees/CoopCode/DEVX-040`) — all three criterion-5 evidence classes present in one real capture, not a mockup — corroborated by `docs/planning/evidence/DEVX-040-live-board.json`, whose `result.tasks[0]` (DEVX-001) independently matches the screenshot's blocking reason and dependency — criterion: 5 (attempt-1 MAJOR resolved).
  - Gate evidence: re-ran `node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-040-gate.json --result-sha=672be473688571b3427dcc05d02ab4d7e387e38d` myself → `VALID`. Re-hashed all 10 files listed in the gate artifact's `artifacts[]` against the working tree myself (sha256) → all 10 match. Re-ran the test suite myself (`npx vitest run --config config/vitest.config.ts src/main/ipc/coop-board.test.ts` from `apps/desktop/orca`) → 5/5 pass, matching the gate's claim. Walked HEAD (`948e682`) back one commit to the reviewed result SHA (`672be473`) and confirmed the only commit on top touches solely `docs/planning/evidence/DEVX-040-gate.json`, this task's own gate file — resultSha binding is valid per `docs/coop/gate-artifact-v1.md`.
  - MINOR — `apps/desktop/orca/src/main/ipc/register-core-handlers.ts` is changed by this diff but is not listed in the task's `scope.allow` (which names only `coop-board.ts`, `coop-board.test.ts`, `preload/index.ts`, `preload/api-types.ts`, `components/coop-board/**`, `App.tsx`, and the gate JSON). The change itself is exactly the two-line addition the attempt-1 review mandated (import + call, mirroring `registerOpenCodeSdkHandlers()`) and is low-risk, but the task spec's `scope.allow` was never amended to reflect it, so the diff is technically outside the declared scope boundary — not flagged as blocking because the change was the literal required fix for a prior BLOCKER and there was no way to resolve that BLOCKER within the original scope list — recommend the task spec's `scope.allow` be corrected for the record so future scope checks on this task aren't confused by a stale list. Criterion: none (process/governance, not acceptance-blocking).
  - MINOR — `docs/planning/evidence/DEVX-040-board.png`, `DEVX-040-board.jpg`, and `DEVX-040-live-board.json` are new files under `docs/planning/evidence/` but only `docs/planning/evidence/DEVX-040-gate.json` is named in `scope.allow`. These are exactly the criterion-5 evidence artifacts the task requires, and adding evidence media alongside the gate JSON is standard practice for this repo's hands-on-evidence convention, but the literal `scope.allow` list undercounts them. Same disposition as above: non-blocking, spec-list gap rather than worker overreach. Criterion: none.
  - Carried forward, unchanged, not required for this rework attempt (per the rework brief): the attempt-1 MINOR on `computeBlocking` only being exercised one dependency-hop deep in tests (criterion 3, still true — no multi-level A→B→C fixture was added this round), and the attempt-1 INFO on the declared gate-3 command path (`tools/pnpm-arm64.cmd`) not executing as literally declared in this worktree (pre-existing across ~10 other closed DEVX tasks, independently reproduced again this round via the local vitest binary with matching exit code).
  - Pre-existing, unrelated to this diff: `register-core-handlers.test.ts` (untouched by this diff) has one pre-existing failing test ("passes the store through to handler registrars that need it") that fails at the `registerOpenCodeSdkHandlers` call (missing `ipcMain` export on its `electron` mock) — a mocking gap that predates and is unrelated to the `registerCoopBoardHandlers()` addition; not caused by this task and not a regression.
