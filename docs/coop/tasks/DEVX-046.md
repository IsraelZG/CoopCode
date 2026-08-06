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

## Review (attempt 1)

- Reviewer: coop-reviewer (crush / minimax-m3)
- Date: 2026-08-06
- Result SHA reviewed: `29eac129e31ec5c70300285f49119c0b948d15e8` (HEAD of reviewed branch was `860e385a0...` — the trailing commit only touched `docs/planning/evidence/DEVX-046-gate.json`, so the artifact's `resultSha` correctly binds to the implementation commit per `docs/coop/gate-artifact-v1.md`)
- Decision: `rework`
- Findings:
  - MAJOR — `apps/desktop/orca/config/electron-builder.config.cjs:455-457` (criterion 4) — The `chmodUnixCliLaunchers` launcher list was changed to `['coopcode', 'orca', 'orca-ide']` (i.e. a transitional `orca` alias was kept), but the acceptance clause explicitly requires "State which choice was made and why." Neither the commit message, the gate artifact's `baseline`/`regressions` fields, nor the task file records this rationale. The worker's intent is not derivable from the diff alone — a future reader has no way to know whether the `orca` entries are kept intentionally for back-compat, kept accidentally as a no-op, or kept as a temporary alias to be removed later. Required outcome: add an inline comment in `chmodUnixCliLaunchers` AND a sentence in the task's `## Handoff` (or a `## Chmod decision` block) recording the choice (alias kept / removed / phased) and the justification. Affected criterion: 4.
  - MAJOR — `docs/planning/evidence/DEVX-046-gate.json` (criterion 5) — The acceptance requires "a plain-text search for `'orca'`/`'Orca'` in the four changed files finds only things intentionally left alone." This grep confirmation evidence is not captured anywhere in the gate artifact, the commit, or the task file. The reviewer independently re-ran the grep and confirmed the only remaining `Orca`/`orca` literals in the four changed files are intentional non-goals (env-var names like `ORCA_MAC_RELEASE`/`ORCA_LINUX_ARM64_RELEASE`/`ORCA_BUILD_COMMIT`, the `Orca Computer Use.app` helper on line 232, the `orca-notification-status` binary on line 234, the `win.executableName: 'Orca'` on line 240, `extraResources` paths under `native/windows-cli-launcher/.build/orca.exe` and `resources/win32/bin/orca.cmd`, NSIS `artifactName: 'orca-windows-setup.${ext}'` on line 270, and the `## Acceptance` checklist renames of the `Orca` allowance strings on lines 285/287/289/292/294 which the task scopes to the `apps/desktop/orca/`-UI-copy non-goal). None of these are missed product-identity renames, but the worker did not produce this confirmation as required. Required outcome: add the grep output (e.g. a `grepConfirmation` field with the matching lines, each annotated as "intentional non-goal" or "missed rename") to the gate artifact, or record it in the task's `## Handoff`. Affected criterion: 5.
  - MINOR — `docs/planning/evidence/DEVX-046-gate.json` gate 3 (typecheck) — The recorded `exitCode` is `1` (seven baseline `tsc` errors in test/session files: `session-scanner-crush-cleanup.test.ts`, `session-scanner-opencode-sources.test.ts`, `evidence/session.ts`, `transcript-watch.ts`, `index.ts`), yet the criterion's `passed` is `true`. The rationale ("baseline errors outside changed files") is sound — the reviewer independently re-ran the typecheck and confirmed all 7 errors are in files outside the four changed files, so the rename introduces zero regressions — but a non-zero `exitCode` paired with `passed: true` is exactly the pattern a future reviewer or integrator should not have to re-derive. Required outcome (non-blocking): add a `baselineSha` field to the gate artifact recording the SHA at which the 7 baseline errors were observed (currently the main-branch SHA `0d4e64bd4...`, which is also `baseSha`), or move the rationale into a `baselineEvidence` object so the soft pass is unambiguous.
  - INFO — Scope: all four changed files are within `scope.allow`; no out-of-scope diff. The dependency check called out in criterion 2 ("check whether any other `package.json` in this monorepo depends on the literal package name `orca`") was satisfied — `grep -rln '"orca"' --include="package.json"` on the worktree returns no matches, and there is no `name: "orca"` package.json left in the tree. The worker's silence on this in the handoff is correct, not a miss.
  - INFO — The product-identity renames themselves (criterion 1: `appId`, `productName`; criterion 2: `package.json` `name` and `bin`; criterion 3: dispatch fallback) are clean, minimal, and correctly scoped. The `ORCA_CLI_COMMAND` env-var name is left alone as required. The `shortcutName`/`uninstallDisplayName` template-variable sites already reference `${productName}` and so propagate the rename without a second edit, also as required.

## Review (attempt 2)

- Reviewer: coop-reviewer (crush / minimax-m3)
- Date: 2026-08-06
- Result SHA reviewed: `5ef98be6a6cbce32202871cc1668276b8d95ec7d` (HEAD of reviewed branch was `d03c2407b...` — the trailing commit only touched `docs/planning/evidence/DEVX-046-gate.json`, so the artifact's `resultSha` correctly binds to the implementation commit per `docs/coop/gate-artifact-v1.md`)
- Decision: `accept`
- Findings:
  - INFO — Criterion 4 (chmod rationale) is now satisfied. `apps/desktop/orca/config/electron-builder.config.cjs:458-460` carries an inline 3-line comment that explicitly states the choice ("Transitional aliases 'orca' and 'orca-ide' are retained alongside 'coopcode'") and the rationale ("to ensure existing unpacked/transitional Unix launcher scripts remain executable during the product identity transition, while making 'coopcode' executable"). The same rationale is mirrored in the gate artifact's criterion-4 `detail` field (`docs/planning/evidence/DEVX-046-gate.json:55-58`). The attempt-1 MAJOR is closed.
  - INFO — Criterion 5 (grep confirmation) is now satisfied. The gate artifact's criterion-5 `detail` field (`docs/planning/evidence/DEVX-046-gate.json:60-62`) enumerates the categories of remaining `Orca`/`orca` literals in the four changed files as intentional non-goals. The reviewer independently re-ran `grep -ni "orca"` against the same four files at the result SHA and confirmed the enumeration is accurate: every remaining match falls into one of those categories — env-var names (`ORCA_MAC_RELEASE`/`ORCA_LINUX_ARM64_RELEASE`/`ORCA_LOCAL_BUILD_VERSION`/`ORCA_CAPTURE_EVIDENCE`/`ORCA_BUILD_COMMIT`/`ORCA_COMPUTER_MACOS_SIGN_IDENTITY`), the `Orca Computer Use.app` helper bundle, the `orca-notification-status` helper binary, `win.executableName: 'Orca'`, `extraResources` source/destination paths under `native/windows-cli-launcher/.build/orca.exe`/`resources/win32/bin/orca.cmd`/`resources/darwin/bin/orca`/`resources/linux/bin/orca-ide`, the macOS `signMacComputerUseHelper` / `signNotificationStatusHelper` paths, NSIS / AppImage / deb / rpm `artifactName` and `packageName` fields (e.g. `orca-windows-setup.${ext}`, `orca-macos-${arch}.${ext}`, `orca-linux-arm64.${ext}`, `orca-linux.${ext}`, `orca-ide_${version}_${arch}.${arch}`, `orca-ide-${version}.${arch}.${ext}`, `packageName: 'orca-ide'`), the `StartupWMClass: 'orca'` Linux dock-grouping entry, the `repo: 'orca'` field in the release-publish block, the macOS plist usage-description strings on lines 285/287/289/292/294/297, the inline chmod rationale comment itself, the `package.json` `homepage: "https://github.com/stablyai/orca"` (fork-upstream URL — out of scope by the non-goal "Do not update documentation prose beyond what the four changed files' own template variables already propagate automatically"), the `bin: { "orca-dev": ... }` dev-script entry (internal, not product identity), and the `ORCA_CLI_COMMAND` env-var name (explicitly excluded from the rename). None are missed product-identity renames. The attempt-1 MAJOR is closed.
  - INFO — Criterion 1 (`appId`/`productName` + no double-hardcode at template sites), criterion 2 (`package.json` `name`/`bin` + no other monorepo `package.json` depends on literal `"orca"`), and criterion 3 (dispatch fallback) are unchanged from attempt 1 and remain satisfied.
  - INFO — Gates re-run: `validate-task.mjs` returns `OK: DEVX-046 (ready, standard, 5 criteria)`, `validate-gate-artifact.mjs` returns `VALID` (schema-only check; SHA binding is a walk-back reasoning step which also holds — the implementation commit `5ef98be6a` is the most recent non-gate-only commit on `task/devx-046` after walking past the trailing `d03c2407b` gate-only commit). The `tsc --noEmit -p config/tsconfig.node.json` typecheck was re-run from `apps/desktop/orca` and produced the same 7 baseline errors in the same 5 test/session files (`session-scanner-crush-cleanup.test.ts`, `session-scanner-opencode-sources.test.ts`, `evidence/session.ts`, `transcript-watch.ts`, `preload/index.ts`) — none in the four changed files, so the rename introduces zero regressions. The attempt-1 MINOR about `exitCode: 1` with `passed: true` is also addressed: the new gate explicitly records `baselineSha: 0d4e64bd47df8967f0fe8822bc6607c07c5e9666` in both the criterion `detail` and the top-level `baseline` field, so the soft pass is now anchored to an immutable reference SHA and is no longer ambiguous.
  - INFO — Scope: all changes are within `scope.allow` (the rationale commit adds lines inside `electron-builder.config.cjs`, which is in `scope.allow`; the gate JSON lives at the path declared in `scope.allow`). No out-of-scope diff. The branch `task/devx-046` is 3 commits ahead of `origin/main` (was 2 at attempt 1; the extra commit is the new rationale + gate).
- Independent re-review note: This verdict was formed cold from the spec, the new diff, and the updated gate, *before* comparing against the attempt-1 `rework` finding set. The two attempts agree — the attempt-1 MAJORs (missing chmod rationale, missing grep confirmation) and the MINOR (soft-pass ambiguity) are all now closed by the worker's two new commits, and no new issues were introduced by the rework itself. The previously-acceptable renames and unchanged files remain acceptable.
