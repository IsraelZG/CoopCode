---
{
  "id": "EXAMPLE-001",
  "title": "Replace with an observable outcome",
  "state": "draft",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": [],
  "scope": {"allow": ["path/or/directory/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "replace-with-a-real-command",
      "purpose": "Demonstrate the changed behavior"
    }
  ]
}
---

> Contrato: Task Spec v1 (`docs/coop/task-spec-v1.md`)
> Schema: `docs/coop/schemas/task-spec-v1.schema.json`
> Validador: `node tools/coop-dev/validate-task.mjs <task.md>`

# EXAMPLE-001 · Replace with an observable outcome

## Outcome

State one result, not a list of implementation activities.

## Acceptance

- [ ] Describe 1–5 externally observable or deterministically testable results.

## Non-goals

- State what a worker may be tempted to add but must not.

## Sources and decisions

- Link current code, ADRs, contracts or completed dependencies.
- Record an unresolved decision instead of inventing it.

## Plan and test mapping

For `standard` and `high-risk`, map each criterion to the intended test or
hands-on check. A `quick` task may omit a separate plan.

## Handoff

Workers and reviewers return evidence to the dispatcher/state owner. That owner
appends immutable attempt evidence and structured decisions; prior evidence is
never rewritten.
