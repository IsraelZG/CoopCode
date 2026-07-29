---
name: coop-worker
description: Implement or rework exactly one assigned Coop task in its designated worktree. Use when a task spec and attempt are ready, including bounded fixes requested by review. Applies TDD where behavior is testable, runs declared gates, records evidence, and hands off without approving or merging.
---

# Coop Worker

Own one attempt, not the roadmap.

## Start

1. Confirm task ID, attempt, immutable base SHA and assigned worktree.
2. Read the complete task and its cited sources.
3. Confirm state is executable and every required decision is present.
4. For rework, treat the blocking review findings as the closed correction
   scope.
5. Preserve any live dispatch IDs and reporting contract.

## Work

1. Reproduce the behavior or write the smallest failing test for each
   behavioral criterion.
2. Implement the minimum change that makes it pass.
3. Refactor only while the tests remain green.
4. Stay inside `scope.allow`. Read-only context does not authorize edits.
5. Do not fix unrelated debt. Record it as a follow-up finding.
6. Run every declared gate exactly as specified.
7. Record commands, exit codes, result SHA and artifacts in the handoff.

TDD is not mandatory for prose, rename, generated formatting or purely visual
CSS. Use the observable check declared by the task instead.

## Block instead of invent

Block or ask when the task contradicts current code, requires a product choice,
needs a path outside scope, lacks a dependency, encounters a secret/approval,
or would require destructive behavior.

## Finish

Return result SHA/files, criteria demonstrated, gate results, remaining risks
and hands-on verification. Under a live dispatch, report completion exactly
once using its injected contract, then stop. Never approve, merge, deploy, pay,
delete material data or edit lifecycle state by hand.
