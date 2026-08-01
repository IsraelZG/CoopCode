---
{
  "id": "DEVX-022",
  "title": "Retire allowed_write_destinations from the overnight policy; defer to each task's own scope.allow",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/coop-dev/validate-budget-policy.mjs",
    "tools/coop-dev/test-budget-policy.mjs",
    "docs/coop/policies/development-budget-v1.json",
    "docs/coop/budget-policy-v1.md",
    "docs/coop/fixtures/budget-policy-v1/valid-policy.json",
    "docs/coop/fixtures/budget-policy-v1/valid-policy-with-extras.json",
    "docs/coop/fixtures/budget-policy-v1/invalid-overnight.json",
    "docs/planning/evidence/DEVX-022-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-022.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-022-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/coop-dev/test-budget-policy.mjs",
      "purpose": "Self-check of the budget policy validator against its fixtures"
    },
    {
      "command": "node tools/coop-dev/validate-budget-policy.mjs docs/coop/policies/development-budget-v1.json",
      "purpose": "The real policy file must still validate after the field is removed"
    }
  ]
}
---

# DEVX-022 · One source of truth for where a task may write

## Outcome

`docs/coop/policies/development-budget-v1.json` no longer declares its own,
separately-maintained list of allowed write paths. Whether a task may write
somewhere is answered by the one mechanism that already exists and is
already enforced per task: that task's own `scope.allow`. This closes
wayfinder ticket 11 without widening a second list that would just go stale
again the next time the backlog's shape changes — which is exactly what
happened to `allowed_write_destinations` between when it was written
(`docs/`/`tools/` covered `DEVX-006`/`DEVX-007`'s violations) and today
(`DEVX-011`, `012`, `014`, `016`, `017`, `020`, `021` all also write to
`apps/desktop/orca/src/`, none of them anticipated when the field was set).

## Acceptance

- [ ] `overnight.allowed_write_destinations` is removed from
      `development-budget-v1.json`, from the validator's required-field list
      and its array/string-shape checks in
      `tools/coop-dev/validate-budget-policy.mjs`, and from both `valid-*`
      fixtures in `docs/coop/fixtures/budget-policy-v1/`.
- [ ] `invalid-overnight.json` still fails validation after the field is
      removed from its own checks — it currently fails for six other
      reasons (`max_tasks: 0`, `max_concurrent_workers: 0`, invalid
      `end_time_utc`, `network: "open"`, empty `allowed_commands`,
      `preserve_evidence` not boolean); confirm it still does, and drop its
      now-inert `allowed_write_destinations: []` line so the fixture doesn't
      keep testing a check that no longer exists.
- [ ] `docs/coop/budget-policy-v1.md`'s field table drops the removed row and
      gains a short note: whether a task's overnight write lands somewhere
      allowed is answered by that task's own `scope.allow` (already validated
      by `validate-task.mjs`), not by a second overnight-specific list.
- [ ] `node tools/coop-dev/test-budget-policy.mjs` (the validator's own
      self-check) and `node tools/coop-dev/validate-budget-policy.mjs
      docs/coop/policies/development-budget-v1.json` (the real policy file)
      both pass after the change.
- [ ] The report states plainly that this closes ticket 11 (which asked only
      to make the policy describe reality) and does **not** authorize
      building or expanding unattended overnight execution — that remains
      explicitly out of scope for this map, unchanged by this task.

## Non-goals

- Do not build, wire, or enable any actual overnight/unattended execution
  path. This task only removes a stale, redundant declaration; it grants no
  new runtime capability, since nothing currently reads
  `allowed_write_destinations` at execution time (confirmed 2026-08-01: only
  `validate-budget-policy.mjs` and its fixtures reference the field — no
  consumer in `apps/desktop/orca/src/**` or the dispatch tooling enforces it
  against a real task's writes).
- Do not add a new mechanism to cross-check a task's `scope.allow` against
  the overnight policy at dispatch time. That is real overnight-execution
  machinery (`DEVX-020`–`023` in the old roadmap numbering, `Fase D2`) and is
  out of scope for this map until a human decides to build it.
- Do not touch `max_tasks`, `max_concurrent_workers`, `end_time_utc`,
  `network`, `allowed_commands`, `preserve_evidence`, `prohibited_actions`,
  or `stop_conditions`. Only `allowed_write_destinations` is in scope.
- Do not change `tools/coop-dev/validate-task.mjs`'s existing `scope.allow`
  enforcement — it already works and is the mechanism this task defers to,
  not something to rebuild.

## Sources and decisions

- `.scratch/wayfinder/issues/11-overnight-budget-policy-write-scope-revision.md`
  — resolved 2026-08-01: replace the global list with each task's own
  `scope.allow`, rather than widening `allowed_write_destinations` (which
  would just recreate the same staleness problem) or leaving it unchanged
  (which would keep describing a reality that stopped being true weeks ago).
- Verified directly on 2026-08-01: `allowed_write_destinations` has no
  runtime consumer anywhere outside `validate-budget-policy.mjs` and its
  fixtures — this decision changes documentation and validation, not
  operational behavior, since no overnight execution exists yet to behave
  differently.
- `docs/coop/policies/development-budget-v1.json` — the file being edited.
- `tools/coop-dev/validate-budget-policy.mjs:50-58` and `:80-87` — exact
  required-field and array-shape blocks to remove.
- `docs/coop/fixtures/budget-policy-v1/invalid-overnight.json` — confirmed to
  fail validation for six reasons independent of
  `allowed_write_destinations`; removing that one check does not make this
  fixture pass.
- `docs/coop/tasks/DEVX-006.md` and `DEVX-007.md` — the original violations
  that prompted ticket 11; both now `done`, cited here only as history.

## Plan and test mapping

1. Remove the field from the real policy file and both `valid-*` fixtures.
   Criterion 1.
2. Remove the corresponding required-field entry and shape-check block from
   the validator. Criterion 1.
3. Drop the field from `invalid-overnight.json`; confirm it still fails
   validation for its other six reasons. Criterion 2.
4. Update `budget-policy-v1.md`'s field table and add the `scope.allow`
   deferral note. Criterion 3.
5. Run both declared validator gates. Criterion 4.
6. Write the report closing ticket 11, explicit about what this does and
   does not authorize. Criterion 5.
7. Write `docs/planning/evidence/DEVX-022-gate.json` per
   `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This task
closes wayfinder ticket 11. It does not open, imply, or unblock any overnight
execution task — that decision, if it ever comes, is separate and later.
