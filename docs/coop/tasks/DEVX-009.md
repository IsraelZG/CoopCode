---
{
  "id": "DEVX-009",
  "title": "Detect stalled and looping agent sessions from scanned session data",
  "state": "draft",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": ["DEVX-006"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/**",
    "docs/planning/evidence/DEVX-009-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-009.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-009-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    }
  ]
}
---

# DEVX-009 · Detect stalled and looping sessions

## Outcome

A read-only check reports, for a given worktree, whether its agent session is
progressing, stalled or repeating itself — so an unattended run can be stopped
on evidence instead of on a wall-clock guess.

## Acceptance

- [ ] Given a session whose last message has `finished_at` set and no newer
      message for longer than a declared threshold, the check reports
      `stalled` with the elapsed time and the last message id.
- [ ] Given a session whose last message has `finished_at` null for longer than
      the threshold, the check reports `in_flight_overdue`, distinguished from
      `stalled`.
- [ ] Given a session with N consecutive assistant messages whose tool calls
      repeat the same target, the check reports `looping` with the repeated
      target and N.
- [ ] Output is JSON on stdout and the process exits non-zero only on its own
      failure, never because a session was judged unhealthy; the verdict is
      data, not an exit code.
- [ ] Fixture-based tests cover one healthy, one stalled, one overdue and one
      looping session, each built from a fixture database rather than a live
      agent.

## Non-goals

- Do not stop, kill or restart any agent, dispatch or process.
- Do not write to any agent database.
- Do not add a background service, timer or daemon; this is a command that runs
  when something asks it to.
- Do not modify the coordinator's existing heartbeat warning
  (`coordinator.ts` warns and never auto-fails, deliberately).
- Do not build a UI.

## Sources and decisions

- Depends on `DEVX-006` landing the Crush scanner; the fields this check reads
  (`messages.finished_at`, `messages.parts`, `sessions.updated_at`) are the
  ones that task maps.
- Prior art for the stance, to preserve: the coordinator warns on a stale
  dispatch after `HUNG_THRESHOLD_MS` (documented as heartbeat × 2) and never
  auto-fails, with the recorded reason that a slow-but-correct worker costs
  more as a false positive than a hung one does as a false negative
  (`apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts`).
- The audits found no loop detection anywhere in Orca, OpenCode or the
  reference repositories, so there is no existing implementation to mirror
  (`docs/coop/DEVX-005-ingestion-profile-gap-matrix.md`).
- This task's code lives under `tools/`, so its tests run with plain `node`,
  not through the Orca suite. See `docs/planning/evidence/BASELINE.md`: that
  suite is already red and must not be used as this task's gate.
- Unresolved, and the reason this task is `draft`: the thresholds and the
  definition of "the same target" for a repeated tool call cannot be chosen
  before real session data from `DEVX-006` is available to look at. Promote to
  `ready` only after `DEVX-006` is accepted and the numbers are set from
  observed sessions, not guessed.
- Also unresolved: whether this check reads Crush only, or all scanned agents.
  Crush-only is the smaller first slice and is the default unless the state
  owner decides otherwise.

## Plan and test mapping

1. Set the thresholds and the repetition rule from real sessions produced by
   `DEVX-006`; record the observed numbers that justify them.
2. Build fixture databases for the four cases and write the tests first, one
   per acceptance criterion.
3. Implement the check as a single command under `tools/`, reading only.
4. Run the declared gates and write
   `docs/planning/evidence/DEVX-009-gate.json` per
   `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts. This check is the input to a
future watchdog profile; do not build the watchdog agent inside this task.
