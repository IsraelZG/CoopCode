---
{
  "id": "DEVX-015",
  "title": "Stop the Orca suite from hanging at teardown: bound resolve-7za-path's real toolset resolution in tests",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/config/scripts/resolve-7za-path.test.mjs",
    "apps/desktop/orca/config/scripts/resolve-7za-path.mjs",
    "docs/planning/evidence/BASELINE.md",
    "docs/planning/evidence/DEVX-015-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-015.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-015-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts config/scripts/resolve-7za-path.test.mjs",
      "purpose": "The previously-hanging file must now terminate on its own, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-015 · Bound the toolset resolution that hangs the suite

## Outcome

`config/scripts/resolve-7za-path.test.mjs` terminates on its own, and the full
Orca suite reaches its own summary line instead of hanging at teardown. Until
this is fixed nobody on this project can measure the suite — every future
baseline, regression check and triage inherits the same dead end.

## Acceptance

- [ ] `resolve-7za-path.test.mjs` runs to completion via the declared gate
      command, with no test reaching a timeout and no manual kill needed.
      Record the wall time.
- [ ] The test no longer performs a real toolset download or subprocess
      exec through `app-builder-lib`'s `getPath7za()`
      (`config/scripts/resolve-7za-path.mjs:82` does
      `require('app-builder-lib/out/toolsets/7zip.js')`). Whatever seam is
      used — injecting the resolver, stubbing the module, or an env guard —
      the production path when actually packaging must be unchanged, and the
      report must say how that was verified.
- [ ] The behavior the tests are meant to cover is still covered: the legacy
      `node_modules/7zip-bin/...` layout branch, the downloaded-toolset
      branch, and the stale-env-var handling at
      `config/scripts/resolve-7za-path.mjs:73` each still have a passing
      assertion. Do not delete a test to make the hang go away.
- [ ] Re-run the full suite once (`pnpm run test`, from `apps/desktop/orca`,
      with `npm_config_virtual_store_dir_max_length=30`) and report whether
      it now prints its summary. **Launch it detached or in a background
      task — a foreground agent tool call caps at 10 minutes and the suite
      needs longer; that mismatch is what made this look unreproducible
      before.** If it still hangs, the remaining cause is a finding: report
      it, update `BASELINE.md`, and do not chase it further in this task.
- [ ] `docs/planning/evidence/BASELINE.md` is updated with whatever the
      suite now does — real counts and duration if it completes, or the
      corrected hang description if it does not.

## Non-goals

- Do not fix any other failing test from the DEVX-013 triage. This task is
  only the hang.
- Do not change how 7za is resolved during a real build. If the fix touches
  `resolve-7za-path.mjs` at all, it must be a test seam, not a behavior
  change to packaging.
- Do not add a global test-level timeout to `config/vitest.config.ts` as a
  substitute for fixing the cause — a masked hang still burns the wall time
  and hides the next one.
- Do not install `7zip-bin` to make the legacy fast path apply. That changes
  the dependency tree to work around a test problem.

## Sources and decisions

- `docs/planning/evidence/DEVX-013-triage.md` — identifies this file as the
  leading candidate for the whole-suite teardown hang, and is the only file
  of the 51 that was deliberately not re-run in isolation, precisely to
  avoid re-triggering it.
- `config/scripts/resolve-7za-path.mjs:82` — the real resolver call.
  Line 34 already records that `app-builder-lib` logs download progress to
  stdout, so the download path is known to be reachable from this module.
- `7zip-bin` is not installed in `node_modules` on this host, so the legacy
  fast path at line 28/31 never short-circuits the download here.
- Observed 2026-07-31: the suite runs all 3695 files, then freezes with zero
  CPU delta across surviving node processes over a 45s sample, never
  printing its summary and never writing `--reporter=json` output.
- `docs/planning/evidence/BASELINE.md` — records that hang and the
  log-derived counts that had to be used instead.

## Plan and test mapping

1. Reproduce the hang in isolation with a hard external timeout so the run
   is bounded. Confirm it is `getPath7za()` and not something else in the
   file. Criterion 2.
2. Introduce the narrowest test seam that avoids the real resolver while
   leaving packaging behavior untouched. Criteria 2 and 3.
3. Run the declared gate command; record wall time. Criterion 1.
4. Re-run the full suite detached; record whether it summarizes.
   Criteria 4 and 5.
5. Write `docs/planning/evidence/DEVX-015-gate.json` per
   `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. If the
suite still hangs after this fix, that is a valid completion provided the
remaining cause is named with evidence — this task buys back measurability,
it does not promise a green suite.
