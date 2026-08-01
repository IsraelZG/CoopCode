---
{
  "id": "DEVX-019",
  "title": "Shard the Orca suite so no single command a worker runs can exceed a bounded, fast wall time",
  "state": "done",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/package.json",
    "apps/desktop/orca/config/vitest.config.ts",
    "apps/desktop/orca/config/vitest.*.config.ts",
    "tools/coop-dev/run-full-suite-detached.mjs",
    "tools/coop-dev/test-run-full-suite-detached.mjs",
    "docs/planning/evidence/BASELINE.md",
    "docs/planning/evidence/DEVX-019-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-019.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-019-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/coop-dev/test-run-full-suite-detached.mjs",
      "purpose": "Self-check of the new detached-run helper, same pattern as test-select-task.mjs"
    }
  ]
}
---

# DEVX-019 · Bound how long any suite command can run

## Outcome

No command a worker runs to gain suite-wide confidence takes longer than a
few minutes, and the one case that genuinely needs the whole suite (refreshing
`BASELINE.md`) runs through a documented, detached mechanism that survives a
tool-call timeout instead of looking like a hang. This buys back what
`DEVX-013`'s worker lost time to today: the suite takes ~16 minutes even once
`DEVX-015` fixes the teardown hang, which is already longer than an agent
tool's foreground timeout ceiling (commonly capped well under that). A worker
who runs `pnpm run test` directly, in foreground, will keep hitting the same
illusion of a hang this project already burned time diagnosing twice.

## Acceptance

- [ ] The suite can be run in at least two to four independent slices (by
      directory/project — e.g. `src/main/**`, `src/renderer/**`,
      `config/scripts/**` + `tools/**`, `tests/e2e/**/*.unit.test.ts` — or
      via Vitest's own `--shard` splitting, worker's choice) such that each
      slice completes well within a few minutes on this host. Expose them as
      named `package.json` scripts (e.g. `test:main`, `test:renderer`) so a
      worker or task gate can target one without memorizing flags.
- [ ] `tools/coop-dev/run-full-suite-detached.mjs` runs the complete,
      unsliced suite in a way that survives an agent tool's timeout: launched
      detached/backgrounded from the calling process, writing a marker file
      on completion (exit code included) and its output to a log file the
      caller polls for, rather than relying on the invoking shell staying
      alive. Must work identically in spirit on Windows, macOS and Linux —
      no `.cmd`/batch-only script (see `apps/desktop/orca/AGENTS.md`'s
      cross-platform rule). Node's own `child_process.spawn(..., {detached:
      true, stdio: 'ignore'})` (or equivalent) is enough; do not add a new
      dependency for this.
- [ ] Running the sliced scripts and the detached full-run script both
      require `npm_config_virtual_store_dir_max_length=30` to be set the same
      way `BASELINE.md` already documents — verify neither approach silently
      drops that requirement.
- [ ] `docs/planning/evidence/BASELINE.md`'s reproduction section is rewritten
      to lead with the sliced commands for everyday use, and describes the
      detached full-run script as the rare, deliberate path for refreshing
      the baseline itself — not the default a worker reaches for.
- [ ] `tools/coop-dev/test-run-full-suite-detached.mjs` proves the helper's
      argument handling and detachment/marker-file contract without needing
      a full 16-minute suite run in the test itself (point it at a short
      fake command for the self-check, the same way other `test-*.mjs`
      scripts in `tools/coop-dev/` avoid depending on slow real operations).

## Non-goals

- Do not fix `resolve-7za-path.test.mjs`'s hang — that is `DEVX-015`,
  independent of this task and not blocked by it (sharding helps regardless
  of whether the hang is fixed, since 16 minutes already exceeds a bounded
  foreground call on its own).
- Do not reduce the suite's total CPU time or fix any failing test. This task
  is about how the suite is invoked and observed, not what's in it.
- Do not change CI configuration (this repo's `pnpm run test` and its CI
  wiring, if any, are out of scope — this task is about local/worker
  ergonomics on a dev host).
- Do not build a general-purpose background-job framework. The detached
  helper does exactly one thing: run a given suite command and report when
  it's done, durably.

## Sources and decisions

- Observed directly today: the DEVX-013 triage's first attempt at the full
  suite ran in Git Bash via a plain backgrounded shell call and looked
  identical to a hang because the agent tool's timeout is well under the
  suite's ~16-minute real duration; a second attempt via a detached
  `cmd.exe`-launched wrapper survived long enough to reveal a *real*
  teardown hang (now `DEVX-015`) that the first attempt's timeout had
  masked. Both problems are real and independent: the tool-timeout ceiling,
  and the teardown hang.
- `docs/planning/evidence/BASELINE.md` — the existing reproduction steps and
  the `npm_config_virtual_store_dir_max_length=30` requirement; do not lose
  this when rewriting the section.
- `apps/desktop/orca/config/vitest.config.ts` — current single-config setup;
  `include` patterns already show the natural directory seams
  (`src/**`, `config/scripts/**`, `tools/**`, `tests/e2e/**/*.unit.test.ts`)
  a sharding approach can follow.
- `apps/desktop/orca/AGENTS.md` — cross-platform rule; the detached-run
  helper must not be Windows-only.
- `tools/coop-dev/test-select-task.mjs` and siblings — the existing
  `test-<name>.mjs` self-check convention this task's new test file follows.

## Plan and test mapping

1. Decide the slicing approach (directory-based `package.json` scripts vs.
   Vitest `--shard`) and measure each slice's wall time on this host.
   Criterion 1.
2. Write `run-full-suite-detached.mjs`: spawn detached, redirect output to a
   log file, write a marker file with the exit code on completion.
   Criteria 2 and 3.
3. Rewrite `BASELINE.md`'s reproduction section. Criterion 4.
4. Write `test-run-full-suite-detached.mjs` against a fast fake command.
   Criterion 5.
5. Run the declared gates and write `docs/planning/evidence/DEVX-019-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This task
 does not change what's red or green in the suite — only how confidently and
 quickly anyone, human or agent, can ask it a question.

## Integration

- Review decision: `accept`
- Result SHA: `5b611fc554a655ef0bad32056c72db2c0958f3e6`
- Merge commit: `ec627ed16`
- Gate: task/Gate Artifact validators and 9 detached-run assertions (`exit 0`).
