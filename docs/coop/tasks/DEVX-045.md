---
{
  "id": "DEVX-045",
  "title": "Stop the packaged app from automatically checking stablyai/orca's GitHub releases for updates",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "high",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/config/electron-builder.config.cjs",
    "apps/desktop/orca/src/main/updater.ts",
    "apps/desktop/orca/src/main/updater.test.ts",
    "apps/desktop/orca/src/main/updater.headless-serve-install.test.ts",
    "apps/desktop/orca/src/main/updater-fallback.ts",
    "docs/planning/evidence/DEVX-045-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "high"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-045.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-045-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "../../../tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/updater.test.ts",
      "purpose": "Run the updater test suite, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-045 · No packaged build phones home to the upstream project it was forked from

## Outcome

A packaged CoopCode build never checks, downloads, or offers to install a
release from `stablyai/orca` — the upstream project this fork's `apps/desktop/orca`
was imported from. Today it does, on a schedule, with no toggle: an
already-running packaged instance (confirmed live on this machine, 2026-08-03)
reports `remoteUpdateSupport: { automatic: true, reason: "available" }`, and
`updater.ts` hardcodes `autoUpdater.setFeedURL({ provider: "generic", url:
"https://github.com/stablyai/orca/releases/latest/download" })`. Left as-is,
a genuine upstream release could silently replace every Coop-specific change
in this fork — including this very task and everything before it in
`docs/coop/tasks/`.

## Acceptance

- [ ] `apps/desktop/orca/config/electron-builder.config.cjs`'s `publish`
      block (`{provider: 'github', owner: 'stablyai', repo: 'orca',
      releaseType: 'release'}`) no longer causes electron-builder to embed
      an `app-update.yml` pointing at `stablyai/orca` in a packaged build.
      Removing the block (rather than repointing it at a repo with no
      release infrastructure, which would just trade a real feed for a
      broken one) is the expected fix unless investigation finds electron-
      builder requires a `publish` block to exist for other packaging
      steps — if so, use the most inert configuration that satisfies that
      requirement and say so.
- [ ] `updater.ts`'s hardcoded `setFeedURL` call to
      `github.com/stablyai/orca` is removed or guarded so it can never run,
      for both the automatic path and a user clicking "Check for Updates"
      from the tray menu — a manual check must not succeed in reaching that
      URL either.
- [ ] `getRemoteServerUpdateSupport()` reports `automatic: false` with an
      honest `reason` for this new state (not `'available'`) on a packaged
      build too, not only on dev/unpackaged builds. A caller reading this
      value must be able to tell updates are disabled, not merely that they
      silently never trigger.
- [ ] No automatic update check is scheduled at startup or on any timer —
      `scheduleAutomaticUpdateCheck` must not fire on its own. Proven by a
      test asserting the schedule/init path is a no-op now, not by absence
      of a crash.
- [ ] `updater.test.ts` and any other existing updater test whose
      expectations assumed the old `stablyai/orca` feed are updated to match
      the new behavior and pass; no unrelated updater test (the manual
      local-build-switch feature, mac install path, etc.) regresses.

## Non-goals

- Do not point the feed at a CoopCode-owned release repo/channel instead.
  That requires real release infrastructure (a build/publish workflow on
  `IsraelZG/CoopCode`) that does not exist yet — a later, separate decision
  if CoopCode ever wants self-hosted auto-updates again.
- Do not remove the manual "switch to a local build" feature
  (`local-builds/local-build-switch.ts`, `local-build-feed-server.ts`) — it
  is user-initiated and unrelated to the automatic-upstream-check risk this
  task closes.
- Do not rename `Orca`/`orca` anywhere (`productName`, `appId`, package name,
  CLI binary). That is a separate, already-scoped task (`DEVX-046`) — this
  task only stops the update check, it does not touch branding.
- Do not change `updater-mac-install.ts`, `updater-prerelease-feed.ts`, or
  any file not listed in `scope.allow` unless a test proves it is genuinely
  required to satisfy an acceptance criterion — if so, treat it the same way
  `DEVX-044` treated its own scope correction: update `scope.allow` here and
  say why, rather than touching it silently.

## Sources and decisions

- Confirmed live, 2026-08-03: `node out/cli/index.js status --json` against
  the already-running packaged `Orca.exe` (pid 4788) returned
  `"remoteUpdateSupport": {"installMode": "interactive", "automatic": true,
  "reason": "available"}`.
- `apps/desktop/orca/config/electron-builder.config.cjs:446-450` — the
  `publish` block pointing at `stablyai/orca`.
- `apps/desktop/orca/src/main/updater.ts:1575-1579` — the hardcoded
  `setFeedURL` call; `:890-913` — `getRemoteServerUpdateSupport()`'s current
  logic (returns `automatic: false` only for dev/unpackaged builds, an
  uninitialized updater, or `unsupported-headless-serve` mode — never for a
  normal packaged build, which is exactly the gap this task closes); `:966`
  and callers — `scheduleAutomaticUpdateCheck`, invoked from several call
  sites including app-startup-adjacent code.
- Decided 2026-08-03: disable outright rather than redirect, since no
  CoopCode release feed exists yet and a broken redirect would be worse than
  an honest "updates disabled."

## Plan and test mapping

1. Read every `scheduleAutomaticUpdateCheck` call site and `activeUpdateSource`
   branch to understand exactly which paths reach the hardcoded feed URL,
   before removing anything. Criteria 2 and 4.
2. Remove/neutralize the `publish` block in `electron-builder.config.cjs`.
   Criterion 1.
3. Remove/guard the `setFeedURL` call and update
   `getRemoteServerUpdateSupport()`'s packaged-build branch to report
   `automatic: false` honestly. Criteria 2 and 3.
4. Update `updater.test.ts` (and any sibling test file whose expectations
   assumed the old feed) to match; run the full updater test file. Criterion
   5.
5. Run the declared gates and write `docs/planning/evidence/DEVX-045-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This is
`risk: high` and `priority: P0` on purpose: until this closes, every packaged
build of this fork is a live vector for silently reverting to unmodified
upstream Orca.

## Review (attempt 2)

- Reviewer: crush/minimax-m3 (coop-reviewer)
- Date: 2026-08-06
- Result SHA reviewed: `4a239bfa310315c91360c65a1244ff18d27d8834` (HEAD; gate-artifact walk-back per `docs/coop/gate-artifact-v1.md` resolves `resultSha: 7f87b7a6` → HEAD by skipping the trailing `DEVX-045-gate.json`-only commit)
- Decision: `rework`
- Findings:
  - BLOCKER — `apps/desktop/orca/src/main/updater.headless-serve-install.test.ts` — Acceptance criterion 5 explicitly says "`updater.test.ts` and **any other existing updater test** whose expectations assumed the old `stablyai/orca` feed are updated to match the new behavior and pass; no unrelated updater test (the manual local-build-switch feature, mac install path, etc.) regresses." Focused re-run of that file (`../../../tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/updater.headless-serve-install.test.ts`): **4 failed | 2 passed | 3 skipped (9)**. The new `getRemoteServerUpdateSupport()` (updater.ts:890-910) unconditionally returns `automatic: false, reason: 'updater-unavailable'` for any packaged build, including `installMode: 'interactive'` and `installMode: 'supervised-headless-serve'`. The headless-serve-install test suite asserts the opposite for the interactive/supervised flow (updater.headless-serve-install.test.ts:496-500 expects `automatic: true, reason: 'available'` for `installMode: 'interactive'`; :237-239 expects a `state: 'available', version: '1.0.61'` `updater:status` from `checkForUpdatesFromMenu`; :311 / :495 expect `autoUpdater.downloadUpdate` to be called when the user requests an install). These are not "unrelated" tests — they cover the live headless-serve upgrade path that the spec change has shut off without coordinating the test surface. The worker ran only `updater.test.ts` (the file inside `scope.allow`); the gate's "16 passed, 4 skipped" summary is technically true for that file but omits 4 broken tests in a sibling updater test file. Required outcome: either (a) add `apps/desktop/orca/src/main/updater.headless-serve-install.test.ts` to `scope.allow` and update the four tests to match the new "updates disabled" reality (the spec's own `Non-goals` clause explicitly authorises this: "update `scope.allow` here and say why, rather than touching it silently" — the "why" is that those tests encode the now-disabled release-update behavior), or (b) decide in a follow-up that the headless-serve release-update flow must keep working (it currently would silently regress in production) and split that work into its own task. Either way, the work as committed leaves the repository in a state where `vitest run src/main/updater.headless-serve-install.test.ts` fails, which violates criterion 5's "pass" and "no unrelated updater test regresses" clauses. — evidence: `vitest` output above; updated code at `apps/desktop/orca/src/main/updater.ts:890-910, 1200-1235`; failing assertions at `apps/desktop/orca/src/main/updater.headless-serve-install.test.ts:237, 311, 495-500`. — criterion: 5.
  - MAJOR — `docs/planning/evidence/DEVX-045-gate.json` — `resultSha: 7f87b7a6164e6522d470bfa3bea8f59f0ad29067` is **the second-to-last commit** in the branch (the result of an amend that only retargets the gate's own `resultSha` field), not the commit that contains the actual code deliverable. `git reflog` for this branch shows the worker did 8 sequential `commit (amend)` operations to chase `resultSha` toward HEAD — the exact pathology `docs/coop/gate-artifact-v1.md` calls out as "five commits in sequência, cada um 'corrigindo' `resultSha` para o HEAD anterior, sem nunca alcançá-lo" and explicitly labels a known failure mode from `DEVX-012`. The `resultSha` in the current gate is the *previous* amend (now unreachable in linear history because each amend rewrote it), and HEAD `4a239bfa3` only touches the gate artifact. The proper sequence per the spec is: result commit (code) + gate commit, with `resultSha` fixed to the result commit's SHA and *never updated again*. The validator passes (it just does a string compare against the supplied `--result-sha`), so this never tripped the gate, but the gate evidence is now a *commit that no longer exists in linear form* and only survives because `git fsck` and the validator don't enforce it. Required outcome: rework the worktree to (1) write the actual code change as a single result commit, (2) write the gate artifact in a separate commit whose only file is `docs/planning/evidence/DEVX-045-gate.json` and whose `resultSha` is the result commit's SHA. The walk-back rule in `prepare-review.mjs` already handles this correctly, so the integrator will be fine once the history is clean. — evidence: `git reflog` shows 8 amends; `git log --oneline 0d4e64bd4..HEAD` shows only one resulting commit because all the amends collapsed; the gate's `resultSha` field is one commit behind HEAD, which is a direct symptom of the chase. — criterion: process / gate-artifact-v1 contract.
  - MINOR — `apps/desktop/orca/src/main/updater.ts:1060-1140` — `pinDefaultReleaseFeed` is now an async function with no callers anywhere in the repo (`grep -rn pinDefaultReleaseFeed apps/desktop/orca/src/` returns only its own declaration). The function still hardcodes `const url = 'https://github.com/stablyai/orca/releases/latest/download'` (line 1133) and still calls `autoUpdater.setFeedURL` with that URL (line 1137). Acceptance criterion 2 says "the hardcoded `setFeedURL` call to `github.com/stablyai/orca` is removed or guarded so it can never run" — the call cannot run today, so the letter of the criterion is satisfied, but the spirit ("a manual check must not succeed in reaching that URL") is fragile: a future refactor that re-calls `pinDefaultReleaseFeed` would silently re-open the upstream leak without any test or type-system guard catching it. The prior attempt-1 reviewer flagged the same risk. Either delete `pinDefaultReleaseFeed` (and its now-orphaned helpers `publishingWindowLastGoodCheck`, `pendingPrereleaseFallback`, the `fetchNewerReleaseTags*` mocks, the `getReleaseDownloadUrl` mock) or move the URL behind a config flag whose default is "disabled". Not a blocker on its own, but combined with the BLOCKER above it adds maintenance risk to the rework. — criterion: 2.
  - MINOR — `apps/desktop/orca/src/main/updater.test.ts:169` — `getReleaseDownloadUrl` mock still returns `https://github.com/stablyai/orca/releases/download/${tag}`. The mock is in the now-unused `pinDefaultReleaseFeed` code path; the new tests at :408, :417, :433, :449 do not exercise it. Dead code, but a grep for `stablyai/orca` in the test file will keep returning one hit, and the spec explicitly wants the test surface to reflect the new behavior. — criterion: 5.
  - INFO — Scope of files actually changed in the base..HEAD range: `apps/desktop/orca/config/electron-builder.config.cjs`, `apps/desktop/orca/src/main/updater.ts`, `apps/desktop/orca/src/main/updater.test.ts`, `docs/planning/evidence/DEVX-045-gate.json`. All four are in `scope.allow`. No out-of-scope file was modified (the BLOCKER is about a *test* that was not modified when it should have been, not about an out-of-scope *edit*).
  - INFO — `validate-task.mjs` and `validate-gate-artifact.mjs` both pass. `validate-gate-artifact.mjs docs/planning/evidence/DEVX-045-gate.json` returns `VALID` (no `--result-sha` flag, so it does not check the staleness; the MAJOR finding above is the structural cause of that staleness).
  - INFO — `updater.test.ts` gate: re-ran `../../../tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/updater.test.ts` and got `Test Files 1 passed (1) | Tests 16 passed | 4 skipped (20)` — matches the gate's `stdout` claim.
  - INFO — Prior `## Review (attempt 1)` also returned `accept`. This attempt disagrees because attempt 1 only ran the in-scope test file and read the diff; the focused re-run of the headless-serve-install test file (triggered by criterion 5's "any other existing updater test ... no ... regresses" clause and the spec's `risk: high, priority: P0` classification) surfaces 4 failing tests that turn a real production code path into a silent regression. The disagreement is itself useful information per the reviewer-skill's append-only policy.
- Acceptance check:
  - Criterion 1 (publish block removed): `apps/desktop/orca/config/electron-builder.config.cjs` `publish` block is gone; the config now ends with `npmRebuild: true`. Confirmed by `git diff` and `grep stablyai config/electron-builder.config.cjs` (only `appId = 'com.stablyai.orca'` remains, which is a separate product-identity concern scoped to `DEVX-046`). **PASS.**
  - Criterion 2 (setFeedURL + manual check): the `setFeedURL({ provider: 'generic', url: 'https://github.com/stablyai/orca/releases/latest/download' })` call inside `setupAutoUpdater` (formerly updater.ts:1575-1579) is deleted (line 1445-1447 now only contains the security comment, twice). `checkForUpdatesFromMenu` (non-`localBuild`) now sends `{ state: 'not-available', userInitiated: true }` directly (updater.ts:1231-1236) without touching the feed URL. `checkForUpdates` delegates to `runBackgroundUpdateCheck`, which sends `{ state: 'not-available' }` (updater.ts:1200-1207). The reachable call sites no longer touch the upstream feed. The `pinDefaultReleaseFeed` dead-code residue is flagged as MINOR above. **PASS with MINOR caveat.**
  - Criterion 3 (packaged-build support): `getRemoteServerUpdateSupport()` (updater.ts:890-910) now returns `{ automatic: false, reason: 'updater-unavailable' }` for any packaged build that is not `unsupported-headless-serve`. The `!autoUpdaterInitialized` early-return was removed (per spec). The new test at updater.test.ts:408-415 directly asserts this. **PASS**, but see BLOCKER: the change has overshot into the headless-serve flow that was supposed to keep working.
  - Criterion 4 (no auto schedule): `scheduleAutomaticUpdateCheck` (updater.ts:963-970) clears any existing timer and sets it to `null` without scheduling a new one. `runBackgroundUpdateCheck` (updater.ts:1200-1207) is reduced to a single `sendStatus({ state: 'not-available' })`. The startup path in `setupAutoUpdater` (formerly lines 1632-1661) no longer calls either function; only `checkForUpdateNudge` and the `powerMonitor.on('resume', ...)` / `app.on('browser-window-focus', ...)` listeners remain, and those only call `checkForUpdateNudge`, not the update check itself. The new test at updater.test.ts:417-431 advances fake timers 30 days and asserts `autoUpdaterMock.checkForUpdates` is never called. **PASS.**
  - Criterion 5 (no test regression): 16 tests pass, 4 darwin-only skipped inside the in-scope test file. **4 tests fail in the out-of-scope `updater.headless-serve-install.test.ts`**: lines :237-239, :311, :495-500 (4 distinct test bodies, 4 failing assertions). The criterion's own language — "any other existing updater test ... no unrelated updater test ... regresses" — covers exactly this case. **FAIL → BLOCKER.**

## Review (attempt 1)

- Reviewer: crush/minimax-m3 (coop-reviewer)
- Date: 2026-08-06
- Result SHA reviewed: `7f87b7a6164e6522d470bfa3bea8f59f0ad29067`
- Decision: `accept`
- Findings:
  - MINOR — `apps/desktop/orca/src/main/updater.ts:1060-1140` — `pinDefaultReleaseFeed` still contains the hardcoded `https://github.com/stablyai/orca/releases/latest/download` URL string and calls `autoUpdater.setFeedURL` with it. The function is now unreachable: not exported and not called from any remaining site in `updater.ts` after the automatic/manual release paths were gutted. The URL string therefore cannot be reached at runtime, but a future refactor that re-introduces a caller would silently re-open the upstream leak. Recommend removing the function (and its helper-only state such as `publishingWindowLastGoodCheck`, `pendingPrereleaseFallback`, `includePrereleaseActive`, the `fetchNewerReleaseTags*` mocks, the `getReleaseDownloadUrl` mock, and `pinDefaultReleaseFeed` itself) in a follow-up. Not a blocker for this task's stated acceptance criteria.
  - MINOR — `apps/desktop/orca/src/main/updater.ts:1515` — `(availableVersion !== null || hasInstallableDownloadedVersion())` adds an `availableVersion` check that is dead after this change: the `'update-available'` event handler that assigned `availableVersion` was removed alongside the rest of the release-update machinery, and the variable stays `null`. Cosmetic, not a behavior change.
  - INFO — Scope correctness confirmed: only the four files listed in `scope.allow` were touched (`electron-builder.config.cjs`, `updater.ts`, `updater.test.ts`, `DEVX-045-gate.json`).
  - INFO — `resultSha` 7f87b7a6 binds to the code-bearing commit; the trailing commit 4a239bfa3 only retargets the gate's own `resultSha` and `--result-sha=` flag after the worker bumped the SHA, so the resultSha-to-HEAD walk-back per the gate-artifact rule resolves cleanly. `validate-gate-artifact.mjs` returns `VALID` for this binding.
  - INFO — `validate-task.mjs` returns `OK: DEVX-045 (ready, standard, 5 criteria)`.
  - INFO — Test count matches gate evidence: 16 passed + 4 darwin-skipped; the four new DEVX-045 cases at updater.test.ts:408, :417, :433, :449 directly assert criteria 2, 3, 4, 5. Local-build-switch, mac install, quit/install lifecycle, watchdog, and Authenticode coverage all survive in the trimmed file.
- Acceptance check:
  - Criterion 1 (publish block): `apps/desktop/orca/config/electron-builder.config.cjs` `publish` block is gone; the file ends with `npmRebuild: true` — confirmed by `git diff` and a fresh grep.
  - Criterion 2 (setFeedURL + manual check): the `setFeedURL({ provider: 'generic', url: 'https://github.com/stablyai/orca/...' })` call inside `setupAutoUpdater` is deleted. `checkForUpdatesFromMenu` (non-`localBuild`) now sends `{ state: 'not-available', userInitiated: true }` directly without touching the feed URL — confirmed in diff and test at :433.
  - Criterion 3 (packaged-build support): the `!autoUpdaterInitialized` early-return was removed; the trailing branch of `getRemoteServerUpdateSupport()` now unconditionally returns `{ automatic: false, reason: 'updater-unavailable' }` for packaged builds. Test at :408 asserts this.
  - Criterion 4 (no auto schedule): `scheduleAutomaticUpdateCheck` is reduced to a no-op that clears any existing timer and sets it to `null` without scheduling a new one. The startup path in `setupAutoUpdater` no longer calls `runBackgroundUpdateCheck` or `scheduleAutomaticUpdateCheck`. Test at :417 advances fake timers 30 days and asserts `checkForUpdates` is never invoked.
  - Criterion 5 (no test regression): 16 tests pass, 4 darwin-only skipped, no test for unrelated features (local-build switch, mac install, quitAndInstall, watchdog, Authenticode) was removed without a replacement or weakened assertion.
