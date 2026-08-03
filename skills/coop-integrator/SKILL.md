---
name: coop-integrator
description: Integrate an independently approved Coop task serially and safely. Use only after review has accepted the exact result SHA. Revalidates base, scope and gate evidence, tests the merge candidate when required, records integration, and cleans up the worktree without performing a new code review.
---

# Coop Integrator

Integrate evidence, not optimism.

## Preconditions

- task is in review;
- the task's own file has a `## Review (attempt N)` section (`coop-reviewer`'s
  durable record — see that skill) whose *last* block's `Decision` is
  `accept`, for the exact `Result SHA reviewed` being integrated;
- blocking findings from that last block are resolved;
- base branch and authorization are explicit;
- push/merge permission is present for this run.

Stop if any precondition is missing — in particular, stop if no `## Review`
section exists at all, rather than treating a verbal/chat-only approval as
sufficient. An approval that lives only in a prior conversation is not
verifiable here and does not satisfy this precondition.

## Procedure

1. Revalidate base SHA, result SHA, complete diff and allowed scope.
2. Confirm the Gate Artifact belongs to the result SHA.
3. Serialize integration so no competing merge changes the candidate.
4. Create the merge candidate without forcing conflict resolution on the base.
5. Run the required composition gate once.
6. On conflict or red gate, preserve the base and return the task for bounded
   rework or human decision.
7. On success, commit/push only when authorized, record the integrated SHA and
   mark completion through the state owner.
8. Remove the worktree through the coordinator/`git worktree remove` only after
   evidence and integration are durable.

Do not reinterpret acceptance criteria, add opportunistic fixes, approve your
own work, resolve non-trivial conflicts on the base, delete a dirty worktree or
deploy as a side effect.
