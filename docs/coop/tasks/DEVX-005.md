---
{
  "id": "DEVX-005",
  "title": "Audit spec-ingestion and agent-profile primitives left out of DEVX-001",
  "state": "done",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["DEVX-001"],
  "blocked_on": [],
  "capabilities": ["repository-read", "external-repository-read"],
  "scope": {"allow": ["docs/coop/DEVX-005-ingestion-profile-gap-matrix.md"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-005.md",
      "purpose": "Validate the task contract"
    }
  ]
}
---

# DEVX-005 · Audit spec-ingestion and agent-profile primitives

## Outcome

Produce a verified matrix for the two layers `DEVX-001` did not inventory —
spec ingestion into a task DAG, and the agent profile/routing catalog — and
record a corrected re-classification of the three `DEVX-001` entries whose
cited evidence contradicts their classification. The correction lives in this
task's own report; `docs/coop/DEVX-001-orchestration-gap-matrix.md` is
integrated evidence for a `done` task and is not rewritten (see Non-goals).

## Acceptance

- [ ] Matrix covers spec → task DAG ingestion (`DOC-001`, `DOC-002`), the agent
      profile and routing catalog (`DEVX-022`), unattended/scheduled execution
      (`DEVX-023`, `DEVX-042`), task-board projection (`DEVX-040`) and the
      OpenCode agent/subagent layer.
- [ ] Each of the three contested `DEVX-001` entries is re-classified in this
      task's report with a `file:line` citation: the "spec decomposition
      EXISTING" claim at
      `docs/coop/DEVX-001-orchestration-gap-matrix.md:126` is checked against
      `apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts:185-192`,
      where the comment on line 185 states decomposition is unimplemented and
      the guard on lines 190-192 throws when no tasks were pre-created;
      `DEVX-023`/`DEVX-042` are checked against
      `apps/desktop/orca/src/main/automations/`; `DEVX-040` is checked against
      `apps/desktop/orca/src/renderer/src/components/dashboard-popout/AgentKanbanBoard.tsx`
      and `apps/desktop/orca/src/shared/dashboard-snapshot.ts`.
- [ ] Every "existing" entry cites its owning source file and at least one test.
- [ ] Every gap states the smallest missing behavior without proposing a second
      scheduler, database, worktree manager or agent runtime.
- [ ] A reviewer can reproduce the inventory using only paths and commands in
      the report.

## Non-goals

- Do not modify runtime, database, CLI or UI code.
- Do not implement any identified gap.
- Do not edit the imported Orca runtime during this audit.
- Do not re-audit the 39 primitives already verified by `DEVX-001`.
- Do not edit `docs/coop/DEVX-001-orchestration-gap-matrix.md`. It is
  integrated evidence for a `done` task (merge commit `d39dddcdf`); prior
  evidence is never rewritten. Record the re-classification only in
  `docs/coop/DEVX-005-ingestion-profile-gap-matrix.md`.
- Do not decide whether to adopt a third-party OpenCode plugin; record the
  routing taxonomy as prior art only.

## Sources and decisions

- `docs/coop/DEVX-001-orchestration-gap-matrix.md:126` — "Existing coverage:
  Orca's `Coordinator` class supports spec decomposition, DAG-based dispatch,
  polling loop, convergence detection, and escalation handling." This is the
  contested claim being re-classified; the file is read-only for this task
  (see Non-goals).
- `docs/coop/development-loop.md`, `docs/planning/task-index.md` (P3 row:
  `DOC-001`, `DOC-002`)
- `apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts:185-192` —
  line 185 comment ("decomposition isn't implemented yet — tasks must be
  pre-created before run()"), lines 190-192 throw `No tasks found...` when
  `listTasks()` is empty.
- `apps/desktop/orca/src/main/automations/` (`service.ts`, `headless-dispatch.ts`,
  `precheck-runner.ts`, `run-target-resolution.ts`, `hermes-cron-output.ts`)
- `apps/desktop/orca/src/renderer/src/components/dashboard-popout/`
  and `apps/desktop/orca/src/shared/dashboard-snapshot.ts`
- OpenCode agent configuration: `agent.<name>` with `mode`, `model`, `prompt`,
  `permission`; delegation via the `task` tool
- Routing-taxonomy prior art (read-only, external): `oh-my-opencode-slim`
  `src/agents/orchestrator.ts` — per-agent Lane / Stats / "Delegate when" /
  "Don't delegate when"
- Unresolved: whether the task board is projected from the Orca orchestration DB
  or from a CoopCode-owned event log. Record the trade-off, do not choose.
- Budget rationale: `DEVX-001` (same lane, same profiles) used 60
  `wall_minutes` and produced a 384-line matrix across 16 categories
  (`docs/coop/DEVX-001-orchestration-gap-matrix.md`). `DEVX-005` covers fewer
  top-level categories but requires a verified `file:line` + test citation per
  re-classified entry and reading one external repository under
  `external-repository-read`. 90 `wall_minutes` / 1 attempt / 1 rework keeps
  the `DEVX-001` precedent with headroom for that added verification cost.

## Plan and test mapping

1. Trace how a task enters the DAG today: `orchestration task-create`, the
   coordinator `decompose()` stub and the `RunRow.objective` field. Map against
   `DOC-001`/`DOC-002`.
2. Inventory `src/main/automations/`: scheduled trigger, missed-run grace
   window, precheck gate, headless dispatch, output snapshot. Re-classify
   `DEVX-023`/`DEVX-042` and state what a budget/stop-condition policy still
   needs.
3. Inventory `DashboardSnapshot` and the agent Kanban buckets
   (`attention`/`working`/`idle`); state what a task-lifecycle board needs that
   the agent board does not provide. Re-classify `DEVX-040`.
4. Inventory the OpenCode agent/subagent layer as the mechanism available for
   `DEVX-022` profiles, and record the routing-policy fields the existing
   `skills/coop-*` prompts do not carry.
5. Write the matrix in `docs/coop/DEVX-005-ingestion-profile-gap-matrix.md`,
   run the declared gate and provide hands-on reproduction commands.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts. `DEVX-022` consumes this
matrix; do not start it before this task is accepted. `DEVX-002` is already
`done` (merge commit `391134841`) and does not depend on this task's output.

## Integration

- Review decision: `accept`
- Result SHA: `8212925236d18deacc305ce833159e9f4511844a`
- Merge commit: `9525716b32a29c3340a3db899aa5b01f792819dc`
- Gate: `node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-005.md`
  (`exit 0`)
