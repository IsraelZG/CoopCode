---
{
  "id": "DEVX-013",
  "title": "Triage the 144 pre-existing Orca suite failures: signal or import noise",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "docs/planning/evidence/BASELINE.md",
    "docs/planning/evidence/DEVX-013-triage.md",
    "docs/planning/evidence/DEVX-013-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-013.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-013-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    }
  ]
}
---

# DEVX-013 · Triage the 144 pre-existing Orca suite failures

## Outcome

Every one of the 49 failing test files in `docs/planning/evidence/BASELINE.md`
is classified as either **signal** (a real defect that could affect current or
future work) or **noise** (an artifact of importing the Orca snapshot —
missing fixture, environment gap, stale mock — with no bearing on this
project's own code). The classification and its reasoning are written down.
This task does not fix anything and does not open new tasks; it produces the
information a human needs to decide which failures are worth a task.

## Acceptance

- [ ] Re-run the full suite once (`pnpm run test` in `apps/desktop/orca`,
      ~16 min, per `BASELINE.md`'s reproduction steps) at current `HEAD` and
      record the file/test counts. If they differ from `BASELINE.md`'s
      captured `bccb83b080ca789e30312882315863d8fc6e7ce1` numbers, rewrite
      `BASELINE.md` with the new commit, date and counts — the file already
      says stale baseline is worse than no baseline.
- [ ] Every failing file gets one line in `docs/planning/evidence/DEVX-013-triage.md`:
      file path, signal/noise, one-sentence reason. Grouping identical
      root causes across files is fine; each file must still appear.
- [ ] The four failures already diagnosed this session are carried through
      verbatim, not re-investigated: `session-scanner-crush-cleanup.test.ts`'s
      "falls back to ps when /proc is unavailable (macOS)" test (3 pre-existing
      TS errors, confirmed byte-identical to base commit `9ce5d97d9` via
      `git show`), `session-scanner-scope.test.ts`, `session-scanner-values.test.ts`,
      and `session-scanner.test.ts`'s "indexes every supported agent" assertion
      (all three confirmed pre-existing via `git stash push -u` / `pop`
      bisection against commit `fc0af2b40`, during `DEVX-012`'s rework).
- [ ] Every file classified **signal** gets a one-sentence note on what would
      need to change, and either cites an existing task that already covers it
      or states plainly that none exists yet.
- [ ] Hands-on evidence: the literal command used to re-run the suite and its
      final summary line.

## Non-goals

- Do not fix any failure found here, signal or noise. A fix is a new task.
- Do not open new task specs from this task's findings — hand the classified
  list to the human, per this ticket's own `research` framing in
  `.scratch/wayfinder/issues/12-orca-suite-144-failures-triage.md`.
- Do not touch product code under `apps/desktop/orca/src/**`. This task reads
  and reports; it does not edit source.
- Do not run the full suite as a gate for any other task — this task is the
  one deliberate exception, and only once.
- Do not investigate the OpenCode SQLite worker-factory-never-invoked issue
  noted during `DEVX-012` review — that test currently *passes* (masking a
  separate, unrelated bug), so it is not one of the 144 failures and is out of
  this task's scope. Note its existence in the triage report as a pointer, not
  a line item.

## Sources and decisions

- `.scratch/wayfinder/issues/12-orca-suite-144-failures-triage.md` — the
  original question: does any of the 144 indicate something broken that
  affects us, or is it snapshot noise. Its execution note about a
  `research/<name>` branch does not apply here — no branch policy has
  changed; this task runs in its own worktree like any other.
- `docs/planning/evidence/BASELINE.md` — current captured counts: 144 tests /
  49 files failing at `bccb83b080ca789e30312882315863d8fc6e7ce1`, measured
  2026-07-30. Main has moved well past that commit since (`DEVX-006` through
  `DEVX-012` integrated); re-measuring is this task's first step, not an
  assumption that the number is unchanged.
- `DEVX-012`'s gate evidence and rework history — already found and bisected
  4 of the 49 files as pre-existing; carry that work forward instead of
  redoing it.
- `tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts <path>`
  — the targeted-run command, useful for re-confirming any single file's
  failure in isolation while triaging.

## Plan and test mapping

1. Re-run the full suite at `HEAD`, compare against `BASELINE.md`, update it
   if the counts moved. Criterion 1.
2. Walk the 49 failing files. For the 4 already diagnosed, copy the existing
   finding into the triage report unchanged. For the rest, read the failure
   output and the file, classify signal/noise with a one-line reason.
   Criteria 2 and 3.
3. For each signal file, write the one-sentence "what would need to change"
   note and check `docs/coop/tasks/*.md` for an existing task before saying
   none exists. Criterion 4.
4. Run the declared gates and write `docs/planning/evidence/DEVX-013-gate.json`
   per `docs/coop/gate-artifact-v1.md`. Criterion 5.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner, who decides
which signal findings become new tasks. This task closing does not imply any
of the 144 got fixed — only classified.
