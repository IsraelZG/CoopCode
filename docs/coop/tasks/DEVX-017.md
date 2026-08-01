---
{
  "id": "DEVX-017",
  "title": "Pin the locale for user-facing schedule labels and number formatting instead of following the host OS",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/shared/automation-schedules.ts",
    "apps/desktop/orca/src/shared/external-automation-jobs-file.ts",
    "apps/desktop/orca/src/shared/automation-schedules.test.ts",
    "apps/desktop/orca/src/shared/external-automation-jobs-file.test.ts",
    "docs/planning/evidence/DEVX-017-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-017.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-017-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/shared/automation-schedules.test.ts src/shared/external-automation-jobs-file.test.ts",
      "purpose": "Run this task's two affected test files, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-017 · Pin the locale for generated labels and numbers

## Outcome

Schedule labels and formatted numbers read the same regardless of the
developer's or user's OS locale. Today a machine set to pt-BR renders
`'domingos at 12:30'` where the app intends `'Sundays at 12:30'`, and
`"more than 10.000 jobs"` where it intends `"more than 10,000 jobs"` — mixed
half-translated output nobody asked for, in strings the app treats as its own
English UI text.

## Acceptance

- [ ] `formatAutomationSchedule('30 12 * * 7')` returns `'Sundays at 12:30'`
      on a host whose OS locale is pt-BR. Root cause is
      `new Intl.DateTimeFormat(undefined, ...)` in
      `src/shared/automation-schedules.ts` — verified 2026-07-31 at lines
      328, 371 and 409; passing `undefined` as the locale means "use the
      system default".
- [ ] The jobs-file error message reads `"more than 10,000 jobs"` on the same
      host. Root cause is
      `EXTERNAL_AUTOMATION_JOBS_MAX_ENTRIES.toLocaleString()` at
      `src/shared/external-automation-jobs-file.ts:50`, also with no locale
      argument.
- [ ] Every `Intl` / `toLocaleString` / `toLocaleDateString` call in the two
      in-scope files either pins its locale explicitly or is documented in
      the report as deliberately user-locale-dependent, with the reason. Do
      not leave an unreviewed `undefined` locale behind in these two files.
- [ ] Both gate test files pass, and the previously-passing tests in them
      still pass. The DEVX-013 triage recorded 1 failure in each file.
- [ ] Hands-on evidence on this host (OS locale pt-BR): show the before and
      after strings literally, not just a green test line — the whole point
      is output a passing test on an en-US machine would not have caught.

## Non-goals

- Do not build or wire an i18n/localization system. `src/renderer/src/i18n/`
  exists for user-facing translation; this task is about strings the app
  generates as its own fixed English labels accidentally following the OS.
- Do not audit locale usage repo-wide. Only the two files in `scope.allow`.
  Other instances found in passing are follow-up findings, not scope.
- Do not change which weekday or number is produced — only how it is
  formatted. A schedule that means Sunday must still mean Sunday.
- Do not "fix" this by changing the tests to accept the localized output.
  The tests are right; the source is wrong.

## Sources and decisions

- `docs/planning/evidence/DEVX-013-triage.md` — both findings, classified
  signal, with the observation that they share one root cause (host locale
  leaking into app-owned strings).
- Verified directly on 2026-07-31 rather than taken on trust:
  `automation-schedules.ts` has three `Intl.DateTimeFormat(undefined, ...)`
  call sites (328, 371, 409); `external-automation-jobs-file.ts:50` calls
  `.toLocaleString()` with no argument.
- This host's OS locale is pt-BR, which is why the failure is visible here at
  all. On an en-US CI machine both tests would pass while the bug remained —
  worth stating in the report, since it explains why the baseline never
  flagged it.
- `docs/planning/evidence/BASELINE.md` — compare against it, not against
  green.
- Choose the pinned locale to match whatever the surrounding code already
  treats as its default English (`'en-US'` unless the codebase says
  otherwise); state the choice and where it came from.

## Plan and test mapping

1. Run both test files to reproduce, recording the literal wrong strings.
2. Pin the locale at each of the four identified call sites; re-run.
   Criteria 1, 2 and 4.
3. Sweep the two files for any remaining unpinned locale call and resolve or
   document each. Criterion 3.
4. Capture before/after strings as hands-on evidence, and write
   `docs/planning/evidence/DEVX-017-gate.json` per
   `docs/coop/gate-artifact-v1.md`. Criterion 5.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Any other
unpinned-locale site noticed outside these two files is recorded as a
follow-up finding, not fixed here.

## Integration

- Review decision: `accept`
- Result SHA: `c3f184c606259820ba99ae9f8135d1554ef643f5`
- Merge commit: `8ef82083c`
- Gate: task/Gate Artifact validators and 25 locale tests (`exit 0`).
