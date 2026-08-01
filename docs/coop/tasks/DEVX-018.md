---
{
  "id": "DEVX-018",
  "title": "Dispatch a ready Coop task by calling Orca's own task-create/worker-start, instead of a copy-paste prompt",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/coop-dev/dispatch-task.mjs",
    "tools/coop-dev/test-dispatch-task.mjs",
    "docs/planning/evidence/DEVX-018-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-018.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-018-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/coop-dev/test-dispatch-task.mjs",
      "purpose": "Self-check of the new dispatch script, same pattern as test-select-task.mjs"
    }
  ]
}
---

# DEVX-018 · Close the manual-copy-paste gap in dispatch

## Outcome

A ready Coop task is dispatched by running one command, and a live agent
appears in Orca's own, already-shipped Agent Kanban dashboard doing the work
— no human copies a prompt into a chat window. This does not build new
orchestration infrastructure: `orchestration task-create` and
`orchestration worker-start` already exist in Orca as tested, working CLI
commands (verified 2026-08-01, not assumed) that register a task and spawn a
PTY-backed agent with an injected preamble. The gap is that nothing in this
project's own tooling calls them yet — `prepare-task.mjs` stops one step
short, printing a prompt for a human to paste instead.

## Acceptance

- [ ] `tools/coop-dev/dispatch-task.mjs <task.md>` exists, checks Orca is
      reachable (`orca status --json`; if not running, either start it via
      `orca open --json` or fail with a clear message — the worker decides
      which, and states the reason), then calls `orca orchestration
      task-create` with the task's title/spec and `orca orchestration
      worker-start` pointed at the worktree `prepare-task.mjs` already
      creates, with an agent identifier the worker verifies is real (check
      `shared/tui-agent-config.ts` for the available agent list — do not
      guess a name).
- [ ] The injected preamble matches what `prepare-task.mjs` currently prints
      by hand: task ID, base SHA, worktree path, an instruction to use
      `$coop-worker`. Reuse `prepare-task.mjs`'s existing worktree-creation
      and prompt-building logic rather than re-deriving it.
- [ ] `--display-name`/`--comment` (whichever `worker-start` actually uses to
      label the pane) carries the Coop task ID and title, so the dispatched
      agent's card in Orca's existing `AgentKanbanBoard`/`dashboard-snapshot`
      reads something meaningful instead of a generic label.
- [ ] Hands-on evidence, not just a green gate: dispatch one real ready task
      through the script and show the resulting card alive in Orca's
      dashboard (screenshot or `dashboard-snapshot` dump), proving the
      wiring reaches real UI a human already looks at.
- [ ] `test-dispatch-task.mjs` self-checks the script's argument handling and
      command construction without needing a live Orca connection for every
      case (mock/inject the CLI-call boundary the same way `select-task.mjs`
      and `prepare-task.mjs` are tested — by function-level seams, not by
      requiring the real app running for the whole suite).

## Non-goals

- Do not build automatic/unattended task **selection**. This task dispatches
  one named task the human (or dispatcher session) already chose to be
  `ready` — `select-task.mjs` already exists for picking one deterministically
  and can be wired in later. Unattended selection without a human in the loop
  is explicitly gated behind the overnight-policy question in wayfinder
  ticket 11, which is still open.
- Do not build a capability registry, lane awareness, or budget enforcement
  at dispatch time. `docs/coop/DEVX-001-orchestration-gap-matrix.md` section
  9 already records these as open gaps in Orca itself; they are separate,
  larger tasks, not part of closing this specific copy-paste gap.
- Do not build the Coop task-lifecycle board (draft/ready/working/review/done,
  gate status, budget consumed, reviewer assignment). Ticket 14 already
  decided that board is a separate CoopCode event log sourced from git Task
  Specs, applying to a future `DEVX-040`. This task only makes the dispatched
  agent visible in Orca's existing, generic Agent Kanban — liveness, not
  Coop-specific state.
- Do not touch any file under `apps/desktop/orca/src/**`. Everything needed
  is already exposed through the `orca` CLI; if the worker finds it genuinely
  isn't, that is a BLOCKER to report, not a reason to add Electron-side code
  in this task.
- Do not attempt multi-machine or federated dispatch. Local only.
- Do not remove or replace `prepare-task.mjs`'s existing copy-paste prompt
  output. Keep it as a fallback path; this task adds automatic dispatch
  alongside it, in case the Orca connection isn't available in some session.

## Sources and decisions

- Verified directly on 2026-08-01, not taken from the audit doc on trust:
  `apps/desktop/orca/src/cli/handlers/orchestration.ts:723` (`task-create`,
  flags `--spec`, `--task-title`, `--display-name`, `--deps`, `--parent`,
  `--run`) and `:819` (`worker-start`, flags `--task`, `--on`, `--worktree`,
  `--name`, `--repo`, `--base-branch`, `--display-name`, `--comment`,
  `--setup`, `--agent`, `--terminal`, `--retry-of`, `--timeout-ms`, `--run`).
  Both call real RPC mutations (`orchestration.taskCreate`,
  `orchestration.workerStart`) backed by real, passing tests per
  `docs/coop/DEVX-001-orchestration-gap-matrix.md` sections 2 and 4
  (`WorkerDispatchState`, `buildDispatchPreamble`, worker lifecycle tests).
- `apps/desktop/orca/src/shared/dashboard-snapshot.ts` — the existing
  `DashboardCard` shape (`bucket`, `dotState`, `task`, `repoId`, `worktreeId`,
  `startedAt`) that any `worker-start`-spawned pane already populates, and
  `AgentKanbanBoard.tsx` (`src/renderer/src/components/dashboard-popout/`),
  the component that renders it. This is why criterion 4 asks for evidence
  from the real dashboard, not a claim that it would work.
- `apps/desktop/orca/src/cli/bundled-skill-guides.ts` — Orca's own bundled
  skill text uses the `orca status --json` / `orca open --json` precondition
  pattern for other CLI integrations; follow the same shape rather than
  inventing a different readiness check.
- `tools/coop-dev/prepare-task.mjs` and `tools/coop-dev/select-task.mjs` —
  the existing worktree-creation and task-selection logic to reuse, not
  duplicate.
- `tools/coop-dev/test-select-task.mjs` — the naming and self-check pattern
  (`test-<name>.mjs`, run directly via `node`, not through vitest) that
  `test-dispatch-task.mjs` follows.
- `docs/coop/DEVX-001-orchestration-gap-matrix.md` section 9 — records what
  Orca's dispatcher still lacks (dependency-satisfaction check before
  dispatch, capability registry, lane awareness); this task does not close
  those, it only stops requiring a human to paste a prompt for the one
  case that already works end to end.
- `.scratch/wayfinder/issues/11-overnight-budget-policy-write-scope-revision.md`
  — still open; this task deliberately keeps a human choosing which task to
  dispatch, so it does not trip that policy question.

## Plan and test mapping

1. Confirm `orca status --json` / `orca open --json` behavior firsthand — if
   the RPC connection genuinely requires the full Electron app open with a
   display (not headless), report that as a finding before writing more of
   the script; it changes what "one command" can mean in practice.
2. Write `dispatch-task.mjs`: parse the task file (reuse `prepare-task.mjs`'s
   logic), create the worktree, call `task-create` then `worker-start` with
   the preamble and display name. Criteria 1, 2 and 3.
3. Dispatch one real ready task through it, capture the dashboard evidence.
   Criterion 4.
4. Write `test-dispatch-task.mjs` covering argument parsing and the
   command-construction boundary. Criterion 5.
5. Run the declared gates and write `docs/planning/evidence/DEVX-018-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. If step 1
finds the Orca connection isn't practically headless-scriptable in this
environment, that is a valid, reportable blocker — escalate with the exact
error rather than working around it with something that isn't real
`worker-start`.
