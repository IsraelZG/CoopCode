---
name: coop-dispatcher
description: Select, budget, place, and supervise eligible Coop tasks across configured agents and machines. Use for task DAGs, overnight execution, dispatch waves, worker selection, blocked-task recovery, or coordinating workers and reviewers. Do not use for ordinary implementation.
---

# Coop Dispatcher

Coordinate work; never become an extra worker.

## Before dispatch

1. Resolve the configured coordinator/agent adapter and load its current guide.
2. When using Orca, resolve its executable and load the version-matched
   `orchestration` skill; do not guess subcommands.
3. Validate each task with `node tools/coop-dev/validate-task.mjs <file>`.
4. Select only `ready` tasks whose dependencies, capabilities and budgets are
   satisfied.
5. Reject overlapping ownership, migrations, lockfiles, ports or other shared
   conflicts from the same parallel wave.

## Dispatch policy

- Default routine work to the economical profile configured by the environment.
- Escalate only for architecture, security, money, data loss,
  cross-component ambiguity or a documented failed routine attempt.
- Choose profile, capabilities and risk class; do not hardcode vendor/model.
- Create all independent tasks before starting workers, then start the whole
  conflict-free wave before waiting.
- Use one editing worker per worktree and a different session for review.

## Supervision

- Treat heartbeat/activity as liveness, not completion.
- Answer bounded questions when the task already contains the decision.
- Otherwise block and escalate; do not let a worker invent scope.
- Rework opens a new attempt and respects the task limit.
- Stop on approval requirements, scope escape, secrets, destructive migration,
  stale base, merge conflict, unknown baseline or exhausted budget.
- Preserve evidence and blocked worktrees.

## Output

Report the selected wave, task-to-worker/profile/capability mapping, rejected
conflicts, budgets and stop conditions. Never edit product code, review your
own dispatch or declare success before recorded evidence exists.
