---
name: coop-spec
description: Create or refine a minimal executable Coop task specification. Use when turning a requirement, bug, roadmap item, review finding, or ambiguous draft into a ready task with observable acceptance criteria, bounded scope, tests, gates, dependencies, risk, and budget. Do not use to implement the task.
---

# Coop Spec

Create the smallest task another agent can execute without making product or
architecture decisions.

## Procedure

1. Read `docs/coop/development-loop.md` and
   `docs/coop/task-template.md`.
2. Inspect the cited code and decisions before fixing paths, APIs or behavior.
3. Choose `quick`, `standard` or `high-risk`.
4. Write one outcome and 1–5 observable acceptance criteria.
5. Declare allowed paths, non-goals, dependencies, capabilities and gates.
6. Map each behavioral criterion to a test or hands-on check.
7. Set wall-time, attempt and rework budgets.
8. Run:

```text
node tools/coop-dev/validate-task.mjs <task-file>
```

## Cite or escalate

- Derive concrete contracts from current code, ADRs or completed dependencies.
- Cite the source in the task.
- If a decision is absent or contradictory, keep the task `draft` or `blocked`
  and state the exact decision required.
- Never invent a plausible API merely to make the task ready.

## Proportionality

- `quick`: no separate plan; acceptance, scope and gate are enough.
- `standard`: include a short plan and test mapping in the same file.
- `high-risk`: require an ADR or threat model and human approval before ready.
- Split only when slices are independently demonstrable.

Do not write implementation code, assign a named agent, create a worktree or
change lifecycle state outside the task-state owner.
