---
{
  "id": "DEVX-046",
  "title": "Rename the product identity from Orca to CoopCode: appId, productName, package name, CLI binary",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "high",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/config/electron-builder.config.cjs",
    "apps/desktop/orca/package.json",
    "tools/coop-dev/dispatch-task.mjs",
    "docs/planning/evidence/DEVX-046-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "high"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-046.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-046-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "../../../tools/pnpm-arm64.cmd exec tsc --noEmit -p config/tsconfig.node.json",
      "purpose": "Confirm the rename does not break the build, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-046 · The app and its CLI answer to CoopCode, not Orca

## Outcome

The product's own identity — window title, installer name, package name, and
CLI binary — says CoopCode, not Orca. This closes the ambiguity that caused
real confusion this session (Orca is simultaneously the upstream project this
was forked from, the folder name, and until now, the product's own displayed
name and CLI command) without attempting the much larger, separate job of
renaming the `apps/desktop/orca/` folder itself or every internal reference
inside it.

## Acceptance

- [ ] `apps/desktop/orca/config/electron-builder.config.cjs`: `appId`
      changes from `'com.stablyai.orca'` to an id namespaced to this
      project (not `stablyai`, since this is no longer that project's
      build); `productName` changes from `'Orca'` to `'CoopCode'`. Anywhere
      `productName`/`appId` is interpolated for installer/uninstaller
      strings (`shortcutName`, `uninstallDisplayName`, etc.) picks up the
      new value automatically through the existing template variables — do
      not hardcode `'Orca'` a second time anywhere those already reference
      `${productName}`.
- [ ] `apps/desktop/orca/package.json`: `"name"` changes from `"orca"` to
      `"coopcode"`, and the `"bin"` entry changes from `"orca":
      "./out/cli/index.js"` to `"coopcode": "./out/cli/index.js"`. Before
      making this change, check whether any other `package.json` in this
      monorepo (or a pnpm workspace file) depends on the literal package
      name `"orca"` — if one does, name the dependency and its fix in the
      handoff rather than silently leaving it broken.
- [ ] `tools/coop-dev/dispatch-task.mjs`'s fallback default (`const orcaCmd
      = process.env.ORCA_CLI_COMMAND || 'orca'`) changes its literal
      fallback to `'coopcode'`, matching the renamed binary. Leave the
      `ORCA_CLI_COMMAND` env var name itself alone — renaming an
      already-documented environment variable is a separate, bigger
      compatibility concern than this task's scope, and nothing here
      requires it.
- [ ] `electron-builder.config.cjs`'s `chmodUnixCliLaunchers` function
      (chmods packaged Unix CLI launcher binaries by name) is updated to
      chmod the new `coopcode` launcher name instead of (or in addition to,
      if a transitional alias is judged worthwhile) `orca`/`orca-ide`. State
      which choice was made and why.
- [ ] Hands-on evidence: after the rename, `apps/desktop/orca`'s TypeScript
      build/typecheck still passes (the declared gate), and a plain-text
      search for `'orca'`/`'Orca'` in the four changed files finds only
      things intentionally left alone (e.g. the folder path itself, or the
      `ORCA_CLI_COMMAND` env var name, both explicit non-goals) — not a
      missed rename.

## Non-goals

- Do not rename the `apps/desktop/orca/` folder or any file inside it. That
  folder path is embedded in roughly 11,000 tracked file paths across this
  monorepo (measured 2026-08-03) and touches essentially every import
  statement in the app — a much bigger, separate undertaking if ever done,
  not part of this task.
- Do not rename the `ORCA_CLI_COMMAND` environment variable, the
  `orca-appimage-cli-redirect-*`/`orca-claude-command-*` temp-file naming
  conventions, or any other internal identifier not explicitly listed above.
  Only the product-facing identity (what a user sees or types) changes here.
- Do not touch `DEVX-045`'s files (the update-feed disablement) even though
  both tasks edit `electron-builder.config.cjs` — coordinate the two diffs
  at review/merge time rather than one task absorbing the other's scope.
- Do not update in-app UI copy, About dialogs, or documentation prose beyond
  what the four changed files' own template variables already propagate
  automatically. A broader copy pass is separate, later work.
- Do not add a compatibility shim, alias binary, or fallback so `orca` (the
  old command) keeps working after this change, unless the acceptance
  criteria above already require one (the Unix launcher chmod question) —
  do not invent additional back-compat beyond what is asked.

## Sources and decisions

- `apps/desktop/orca/config/electron-builder.config.cjs:21` (`appId =
  'com.stablyai.orca'`), `:65-66` (`appId`, `productName: 'Orca'`),
  `:271-272` (`${productName}` template usage in installer strings),
  `:454-467` (`chmodUnixCliLaunchers`, hardcodes `['orca', 'orca-ide']`).
- `apps/desktop/orca/package.json:2` (`"name": "orca"`), `:8` (`"bin":
  {"orca": "./out/cli/index.js"}`).
- `tools/coop-dev/dispatch-task.mjs:47-48` — already reads
  `ORCA_CLI_COMMAND` first and falls back to the literal string `'orca'`
  only if unset; this is the one call site needing an update for the CLI
  rename to work without every existing script breaking.
- Measured 2026-08-03: `git ls-files` on this repo returns roughly 11,100
  tracked files; the overwhelming majority whose path contains "orca" do so
  only because they live under `apps/desktop/orca/`, not because they
  reference the brand name — this is the basis for scoping the folder
  rename out of this task.
- Decided 2026-08-03 alongside `DEVX-045`: rename product identity now
  (cheap, resolves real ambiguity); treat the folder-path rename as a
  separate, much larger future decision, not part of this task.

## Plan and test mapping

1. Grep the four files in scope for every literal `orca`/`Orca` occurrence
   before editing, to build a complete checklist rather than editing by
   memory. Criterion 5.
2. Change `appId`/`productName` in `electron-builder.config.cjs`; confirm
   the two template-variable usages need no separate edit. Criterion 1.
3. Change `package.json`'s `name`/`bin`; search the monorepo for any other
   package depending on the literal name `"orca"`. Criterion 2.
4. Update `dispatch-task.mjs`'s fallback default. Criterion 3.
5. Update `chmodUnixCliLaunchers`'s launcher name list; decide and justify
   whether to keep a transitional `orca` alias. Criterion 4.
6. Run the declared gate (typecheck) and capture the grep-based confirmation
   for criterion 5.
7. Run the declared gates and write `docs/planning/evidence/DEVX-046-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
a product that introduces itself as CoopCode everywhere a user looks — not a
renamed folder, and not a promise that every internal reference is gone.
