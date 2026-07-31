---
{
  "id": "DEVX-008",
  "title": "Reproduce the ARM64 packaging gate at the current repository layout and version the on-demand build script",
  "state": "done",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/**",
    "docs/planning/evidence/**"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 2, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-008.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-008-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    }
  ]
}
---

# DEVX-008 · Reproduce the packaging gate at the real layout

## Outcome

A single documented command produces an installed, runnable Windows ARM64
CoopCode build from `apps/desktop/orca`, and the evidence records that path —
replacing `PLAT-009`, whose approval was obtained at a repository location that
no longer exists.

## Acceptance

- [ ] `tools/build-coopcode.ps1` is committed and, run from a checkout with no
      `node_modules`, produces `C:\Dev2026\builds\coopcode\current\Orca.exe`
      plus the launcher and `build.json` stamp.
- [ ] The packaged `Orca.exe` is verified ARM64 (PE machine `0xAA64`) and the
      bundled `opencode.exe` answers `--version`.
- [ ] Evidence records the `MAX_PATH` regression and its fix: the build fails
      with `MSB3491` at the current layout without
      `npm_config_virtual_store_dir_max_length`, and succeeds with it.
- [ ] At most two installed builds exist after two consecutive runs
      (`current` and `previous`), demonstrated by running the script twice.
- [ ] `docs/planning/evidence/PLAT-009.md` is not edited; a new evidence file
      states that the earlier approval was obtained at
      `C:\Dev2026\external_repos\orca` and does not hold for
      `apps/desktop/orca`.

## Non-goals

- Do not build the NSIS installer; `--dir` (unpacked) is the target of this
  task.
- Do not change any file under `apps/desktop/orca`.
- Do not enable `LongPathsEnabled` or any other system-wide setting.
- Do not add CI automation; this build runs on demand only.
- Do not rewrite `PLAT-009`; prior evidence is never rewritten.

## Sources and decisions

- `docs/planning/evidence/PLAT-009.md` records a successful ARM64 packaging run
  whose checkout was `C:\Dev2026\external_repos\orca` (30 characters). The
  active snapshot is at `apps/desktop/orca` (40 characters).
- Observed on 2026-07-30: the node-pty native rebuild produces
  `…\.pnpm\node-pty@1.1.0_patch_hash=<hash>\node-addon-api@7.1.1\node_modules\node-addon-api\Release\obj\…\node_addon_api_except.lastbuildstate`,
  263 characters against MSBuild's 260 limit, failing with `MSB3491` in
  `Microsoft.CppBuild.targets(385,5)`. The ten extra characters of the new
  location are the whole regression.
- Fix in use: `npm_config_virtual_store_dir_max_length=30` at install time
  shortens the pnpm virtual-store directory name from 60 characters, bringing
  the path to roughly 233. There is no CLI flag for this setting on `pnpm
  10.24.0`, and setting it via the vendored `apps/desktop/orca/.npmrc` is
  avoided so the imported runtime stays unedited.
- Rejected and recorded so it is not retried: mounting the directory on a
  drive letter with `subst` does not work, because `realpath` resolves the
  virtual drive back to the `C:` path before MSBuild sees it.
- A second failure mode seen once and not reproduced: `build:electron-vite`
  crashed with `0xC0000005` while bundling the renderer under memory pressure.
  Note it in the evidence as a known flake; the `attempts: 2` budget covers it.

## Plan and test mapping

1. Commit `tools/build-coopcode.ps1` as it stands, then delete
   `apps/desktop/orca/node_modules` and run it end to end — criteria 1 and 2.
2. Capture the failing case by running the install once without the environment
   variable and recording the `MSB3491` output — criterion 3.
3. Run the script twice in a row and list the install directory — criterion 4.
4. Write the new evidence file and the Gate Artifact
   `docs/planning/evidence/DEVX-008-gate.json` per
   `docs/coop/gate-artifact-v1.md` — criterion 5.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts. This task writes only under
`tools/` and `docs/`, so it is the one task in this wave that the overnight
policy in `docs/coop/policies/development-budget-v1.json` already permits
unattended.

## Integration

- Review decision: `accept`
- Result SHA: `4c2c5a9cc529dc00fa73a4ddc405c7e1e2c0a00e`
- Merge commit: `b50242e9e`
- Gate: task and Gate Artifact validators (`exit 0`).
