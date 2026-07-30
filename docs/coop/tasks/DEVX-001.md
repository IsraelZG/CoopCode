---
{
  "id": "DEVX-001",
  "title": "Map existing Orca orchestration primitives to the CoopCode development loop",
  "state": "done",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["PLAT-013"],
  "blocked_on": [],
  "capabilities": ["repository-read", "external-repository-read"],
  "scope": {"allow": ["docs/coop/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-001.md",
      "purpose": "Validate the task contract"
    }
  ]
}
---

# DEVX-001 · Map existing orchestration primitives

## Outcome

Produce a verified matrix mapping every requirement in
`docs/coop/development-loop.md` to an existing primitive/test in the imported
Orca snapshot or a specific implementation gap.

## Acceptance

- [ ] Matrix covers task state, dispatch, worktree, evidence, review, rework,
      integration, budgets, overnight stop conditions and remote workers.
- [ ] Every “existing” entry cites its owning source file and at least one test.
- [ ] Every gap states the smallest missing behavior without proposing a second
      scheduler, database or worktree manager.
- [ ] Matrix identifies which CORE/FLOW/DIST and DEVX roadmap tasks are
      obsolete, unchanged or need narrower scope.
- [ ] A reviewer can reproduce the inventory using only paths and commands in
      the report.

## Non-goals

- Do not modify runtime, database, CLI or UI code.
- Do not implement any identified gap.
- Do not import the frozen SuperApp/Nexus backend.
- Do not edit the imported Orca runtime during this audit.

## Sources and decisions

- `docs/coop/development-loop.md`
- `docs/coop/development-roadmap.md`
- `docs/planning/task-index.md`
- `apps/desktop/orca/ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md`
- `apps/desktop/orca/ORCHESTRATION_STRUCTURED_OUTPUT_DESIGN.md`
- `apps/desktop/orca/skills/orchestration/SKILL.md`

## Plan and test mapping

1. Inventory Run/Task/Dispatch and lifecycle owners.
2. Inventory worktree, worker-start, federation and output evidence.
3. Trace review/rework/integration support and missing policy.
4. Write the matrix in `docs/coop/DEVX-001-orchestration-gap-matrix.md`.
5. Run the declared gate and provide hands-on reproduction commands.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts.

## Integration

- Review decision: `accept`
- Result SHA: `c749687330333cc713a43c03a08a216c1c468190`
- Merge commit: `d39dddcdf216bd1955ee4b0116c006cbdaed57f6`
- Gate: `node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-001.md`
  (`exit 0`)
