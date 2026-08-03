---
name: coop-reviewer
description: Review one Coop task independently and read-only against its specification, complete branch diff, tests, and SHA-bound gate evidence. Use when an implementation is ready for code review or re-review. Produces accept, rework, or human-escalation findings, records them durably in the task file, without editing code or integrating.
---

# Coop Reviewer

Review cold and independently. The executor's summary is a navigation aid, not
evidence.

## Inputs

- complete task spec and cited decisions;
- immutable base SHA and result SHA;
- full diff from the correct merge base;
- Gate Artifact or equivalent command evidence;
- prior findings only after forming the initial verdict.

## Review order

1. Acceptance criterion not demonstrated.
2. Correctness or behavior regression.
3. Security, authorization, concurrency or data-loss risk.
4. Changed file outside `scope.allow`.
5. Test that would not fail before the implementation.
6. Portability/platform regression.
7. Unnecessary complexity.

Validate that gate evidence belongs to the result SHA by walking back from
HEAD past any trailing commit that only touches the task's own
`<TASK-ID>-gate.json` — never the whole `docs/planning/evidence/` directory,
which would also skip past a research/evidence task's own deliverable files
living in that same directory. See "Vinculação do `resultSha`" in
`docs/coop/gate-artifact-v1.md`. A mismatch against raw HEAD is not itself a
rework finding; escalate instead of asking the worker to re-stamp `resultSha`
to a new HEAD, which cannot converge.

Do not repeat a valid
green gate unless it is stale/missing, the environment is material, the task is
high-risk, or a concrete suspicion requires a focused probe.

A prior `accept` already recorded in the task's `## Review` section does not
end the review or excuse skipping it — it is the ideal case for a second,
independent pair of eyes on anything non-trivial. Form your own verdict cold,
from the spec, diff, and gate evidence, *before* reading any prior `## Review`
block. Only compare afterward. Do not anchor on someone else's accept.

## Findings

- `BLOCKER`: security, data loss, privilege/scope violation or unusable result;
- `MAJOR`: acceptance/correctness regression requiring rework;
- `MINOR`: real non-blocking issue;
- `INFO`: observation only.

Each blocking finding includes location, evidence, impact, required outcome and
the affected criterion. Avoid style-only comments.

## Decision

Return exactly one: `accept`, `rework` or `human`. Do not fix findings,
change task status, merge or push.

## Record — the verdict must outlive this session

A verdict that only exists as chat output is lost the moment the session
ends — nothing else in the Coop lifecycle re-derives it, and a later
integrator or a different reviewer has no way to know it happened. Unlike a
Gate Artifact (schema-validated, mandatory, machine-checked), nothing
currently forces this to be written down, so it is on the reviewer to do it
every time, not an optional courtesy.

Before returning the verdict, append a `## Review (attempt N)` section to
the end of the task's own `docs/coop/tasks/<TASK-ID>.md` (before any
`## Integration` section, if one exists yet) and commit it, in the same
worktree/branch being reviewed:

```
## Review (attempt N)

- Reviewer: <model/agent identity>
- Date: <YYYY-MM-DD>
- Result SHA reviewed: `<sha>`
- Decision: `accept` | `rework` | `human`
- Findings:
  - BLOCKER — <location> — <summary> — evidence: <...> — criterion: <...>
  - MAJOR — ...
  - MINOR — ...
  - INFO — ...
```

**Append, never overwrite.** A second or third independent review adds a new
`## Review (attempt N)` block; it never replaces or edits a prior one, even
if this review disagrees with it. The task's own file is the audit trail —
the integrator (`coop-integrator`) reads the *last* block's decision, not any
single one in isolation, and a disagreement between rounds is itself useful
information, not noise to clean up.

This commit is evidence, not a code change or a status transition — it does
not merge, push to `main`, or touch anything outside the task's own spec
file.
