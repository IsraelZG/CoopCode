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
    "apps/desktop/orca/src/main/updater.check-failure.test.ts",
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
      "command": "../../../tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/updater",
      "purpose": "Run the FULL updater test surface (all 10 updater*/updater-*.test.ts files, directory-prefix match), from apps/desktop/orca — widened after three rework attempts each broke a sibling file the narrower per-file gate never covered"
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

## Review (attempt 4)

- Reviewer: crush/minimax-m3 (coop-reviewer)
- Date: 2026-08-06
- Result SHA reviewed: `c8de24117fae383bd7bf3abd684dfdcf91bad5f9` (HEAD; gate-artifact walk-back per `docs/coop/gate-artifact-v1.md` resolves `resultSha: c8de24117` → HEAD by skipping the trailing `DEVX-045-gate.json`-only commit `3d71c845b`)
- Decision: `rework`
- Findings:
  - BLOCKER — `apps/desktop/orca/src/main/updater.check-failure.test.ts` — Acceptance criterion 5 says "no unrelated updater test (the manual local-build-switch feature, mac install path, etc.) regresses". A full `vitest run --config config/vitest.config.ts src/main/updater` produces `Test Files 1 failed | 8 passed | 1 skipped (10) | Tests 4 failed | 93 passed | 11 skipped (108)` — the four failures are all in `updater.check-failure.test.ts`, a file that is **not** in `scope.allow` and was not touched by any commit in `0d4e64bd4..HEAD`. The failures are the same kind of cross-test-file regression attempt 2 caught in `updater.headless-serve-install.test.ts`: the file exercises `autoUpdater.checkForUpdates()` and the `error`/`checking`/`idle` updater-status flow, all of which are now dead because `checkForUpdatesFromMenu` (non-`localBuild`, updater.ts:1238-1240) and `checkForUpdates` (delegating to `runBackgroundUpdateCheck`, updater.ts:1205-1213) never reach `autoUpdater.checkForUpdates` anymore. The four failing tests are:
    - `surfaces GitHub release-transition failures with calmer copy and no short retry` (line 130): expects `state: 'checking'` then `state: 'error'`; DEVX-045 produces only `state: 'not-available'`.
    - `surfaces missing latest-mac.yml to user-initiated checks with calmer copy` (line 165): expects the friendly error path; DEVX-045 produces only `state: 'not-available'`.
    - `silently drops background benign failures to idle and waits for the hourly retry` (line 192): expects `state: 'idle'`; DEVX-045 produces `state: 'not-available'`.
    - `backs off consecutive failing background retries instead of re-checking hourly forever` (line ~217): expects `autoUpdaterMock.checkForUpdates` to be called; DEVX-045 never calls it.
    Verified on `main` (`4be2f803c`): same file, same four test bodies, all 4 pass. So this is a real DEVX-045 regression, not a pre-existing failure. Confirmed on the attempt-3 result SHA (`cdb0a738e`) the same four tests fail (regression already present in attempt 3; the worker did not run the full updater directory and missed it on the rework). The gate artifact at `3d71c845b` only invokes `updater.test.ts + updater.headless-serve-install.test.ts` and reports `22 passed, 7 skipped`; the spec's declared gate command in the task front-matter is `updater.test.ts` only. Neither covers the failing file. The spec's Non-goals clause authorises exactly this kind of expansion: "Do not change ... unless a test proves it is genuinely required to satisfy an acceptance criterion — if so, treat it the same way `DEVX-044` treated its own scope correction: update `scope.allow` here and say why, rather than touching it silently." Required outcome: either (a) add `apps/desktop/orca/src/main/updater.check-failure.test.ts` to `scope.allow` with a justification ("these tests cover the now-removed release-feed failure-handling path; the new behavior is 'never check, never fail' so the failure-handling assertions become unreachable and the test bodies need to be re-pointed at the local-build path or removed entirely"), and update the four tests to match the new "release checks never reach autoUpdater" reality, or (b) split the work into a follow-up task. Either way, `vitest run src/main/updater.check-failure.test.ts` must return 0 failures before the integrator can accept. The gate command and/or the gate artifact must also be updated to cover this file. — evidence: `vitest run --config config/vitest.config.ts src/main/updater` summary above; on `main` the same file passes 4/4; in attempt-3 result SHA `cdb0a738e` it also fails 4/4, so this regression has been live in the worktree since the prior attempt's commit `e83a170be` and the current review is the first one to surface it. — criterion: 5.
  - MAJOR — `docs/planning/evidence/DEVX-045-gate.json` (gates[2].command) and the spec's declared gate — The task's front-matter gate command (line 32 of `docs/coop/tasks/DEVX-045.md`) is `"../../../tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/updater.test.ts"` (one file). The worker's gate artifact at attempt 3 added `src/main/updater.headless-serve-install.test.ts` (line 30) — a scope widening that attempt 2's BLOCKER justified because that file's tests were directly affected by the change. The same reasoning applies to `updater.check-failure.test.ts` (per the BLOCKER above), but the gate artifact does **not** include it. The gate as written is *green* even though `4 tests fail | 93 passed` in the broader updater suite. This is the same gate-narrower-than-the-reality issue attempt 1's reviewer (me) implicitly raised by trusting the spec's narrow gate; the spec's own Non-goals clause authorises widening `scope.allow` (which is what should happen here). Required outcome: add `src/main/updater.check-failure.test.ts` to the gate's command list, and to `scope.allow` in the task front-matter, with a one-line justification tying it to the BLOCKER above. The integrator checks gates; if the gate doesn't catch the regression, the gate is wrong. — evidence: `docs/planning/evidence/DEVX-045-gate.json:30` lists only two test files; `vitest run src/main/updater.check-failure.test.ts` returns 4 failures. — criterion: process / gate-artifact-v1 contract.
  - INFO — Prior attempt-3 MAJOR (criterion 3 leak in `getRemoteServerUpdateSupport` fall-through): resolved cleanly. The rework (c8de24117) removed the dead `!autoUpdaterInitialized` early-return and changed the default branch to `{ installMode: updateInstallMode, automatic: false, reason: 'updater-unavailable' }` (updater.ts:905-909). The headless-serve-install test at `updater.headless-serve-install.test.ts:519-523` was updated to assert the same value, eliminating the test/test disagreement flagged in attempt 3. Both test files now consistently assert `automatic: false, reason: 'updater-unavailable'` for the packaged interactive mode. **Criterion 3 PASS.**
  - INFO — `validate-task.mjs docs/coop/tasks/DEVX-045.md` returns `OK: DEVX-045 (ready, standard, 5 criteria)`.
  - INFO — Gate artifact binding: `node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-045-gate.json --result-sha=c8de24117fae383bd7bf3abd684dfdcf91bad5f9` returns `VALID`. `resultSha: c8de24117` correctly resolves to the code commit; trailing commit `3d71c845b` only touches the gate artifact. Clean two-commit history (no amend-chasing): `git reflog` shows `c8de24117` and `3d71c845b` as fresh commits on top of the prior attempt's reset.
  - INFO — Scope of files in `0d4e64bd4..HEAD`: `apps/desktop/orca/config/electron-builder.config.cjs`, `apps/desktop/orca/src/main/updater.ts`, `apps/desktop/orca/src/main/updater.test.ts`, `apps/desktop/orca/src/main/updater.headless-serve-install.test.ts`, `docs/coop/tasks/DEVX-045.md`, `docs/planning/evidence/DEVX-045-gate.json`. All code/docs files are in `scope.allow`; the worker's prior review-attempt appends (cdb0a738e, this review) also touch only `docs/coop/tasks/DEVX-045.md` and the gate artifact.
  - INFO — Prior MINORs (dead `pinDefaultReleaseFeed` residue in updater.ts:1060-1140, the `getReleaseDownloadUrl` mock in `updater.test.ts:168`, the `(availableVersion !== null || hasInstallableDownloadedVersion())` cosmetic at updater.ts:1515) remain open. They are not blockers for any acceptance criterion as written, and removing them would touch files outside `scope.allow` (`updater.test.ts:168` is in scope; the others are not). Per the spec's Non-goals clause, they belong to a follow-up. Not new, not blocking.
  - INFO — Disagreement with prior attempts 1, 2, 3: attempts 1 and 3 ran only the gate-listed test files and read the diff; attempt 2 ran a focused single-file re-run that caught a different broken test file. None of the prior three reviews ran `vitest run src/main/updater` (the full updater directory). The reviewer-skill's append-only policy explicitly says: "Do not repeat a valid green gate unless it is stale/missing, the environment is material, the task is high-risk, or a concrete suspicion requires a focused probe." A `risk: high, priority: P0` task on its 4th review with a gate narrower than the test surface is exactly the high-risk / concrete-suspicion case — the broader re-run is justified, and the resulting test/test disagreement is itself the finding. The disagreement is useful information.
- Acceptance check:
  - Criterion 1 (publish block): `apps/desktop/orca/config/electron-builder.config.cjs` `publish` block is gone; the config now ends with `npmRebuild: true`. **PASS.**
  - Criterion 2 (setFeedURL + manual check): the `setFeedURL({ provider: 'generic', url: 'https://github.com/stablyai/orca/releases/latest/download' })` call inside `setupAutoUpdater` is deleted. `checkForUpdatesFromMenu` (non-`localBuild`) sends `{ state: 'not-available', userInitiated: true }` directly. `checkForUpdates` delegates to `runBackgroundUpdateCheck` which sends `{ state: 'not-available' }`. **PASS.**
  - Criterion 3 (packaged-build support): `getRemoteServerUpdateSupport()` now returns `{ installMode: updateInstallMode, automatic: false, reason: 'updater-unavailable' }` for the default packaged branch (updater.ts:905-909). No more `automatic: true, reason: 'available'` in the production path. The dead `!autoUpdaterInitialized` early-return was removed. Both test files assert the same value. **PASS** (regression from attempt 3 resolved).
  - Criterion 4 (no auto schedule): `scheduleAutomaticUpdateCheck` is a no-op; `runBackgroundUpdateCheck` is reduced to a single `sendStatus({ state: 'not-available' })`. Startup path in `setupAutoUpdater` no longer calls either. **PASS.**
  - Criterion 5 (no test regression): the two test files in the gate (`updater.test.ts`, `updater.headless-serve-install.test.ts`) pass — 22 passed, 7 skipped. But `updater.check-failure.test.ts` (4 tests) fails because the release-feed failure-handling path it asserts is now unreachable. **FAIL → BLOCKER.**

## Review (attempt 3)

- Reviewer: crush/minimax-m3 (coop-reviewer)
- Date: 2026-08-06
- Result SHA reviewed: `64017a43e363bdabe39b78d2c52df046392339e6` (HEAD; gate-artifact walk-back per `docs/coop/gate-artifact-v1.md` resolves `resultSha: 64017a43e` → HEAD by skipping the trailing `DEVX-045-gate.json`-only commit `ed8599d10`)
- Decision: `rework`
- Findings:
  - MAJOR — `apps/desktop/orca/src/main/updater.ts:890-916` — Acceptance criterion 3 explicitly says `getRemoteServerUpdateSupport()` "reports `automatic: false` with an honest `reason` for this new state (not `'available'`) on a packaged build too". The rework (64017a43e) re-ordered the function so the new fall-through branch is `{ installMode: updateInstallMode, automatic: true, reason: 'available' }` (line 911-915) — exactly the value the criterion forbids. The new `if (!autoUpdaterInitialized)` early-return (line 905-910) is dead code in production: `autoUpdaterInitialized` is set to `true` inside `setupAutoUpdater` (updater.ts:1459) before any production caller of `getRemoteServerUpdateSupport()` can run, so the new fall-through is what fires in a normal packaged interactive/supervised build. The test at `updater.test.ts:408-415` only passes because it deliberately does *not* call `setupAutoUpdater` first, leaving `autoUpdaterInitialized` at its module-load default of `false` (updater.ts:74) — so the test asserts the dead branch, not the production branch. The companion test at `updater.headless-serve-install.test.ts:519-523` does call `setupAutoUpdater` (line 507) and was edited (64017a43e) to expect `automatic: true, reason: 'available'`, which makes the regression test-passing instead of test-failing. The prior attempt-2 code (e83a170be) was correct on this axis: the default branch was `automatic: false, reason: 'updater-unavailable'`. Required outcome: restore the default branch to `automatic: false, reason: 'updater-unavailable'` (or another honest `automatic: false` reason distinct from `'available'`), keep the headless-serve test happy without weakening criterion 3. One workable shape: keep the `unsupported-headless-serve` branch as-is, drop the `!autoUpdaterInitialized` early-return entirely, and let the default be `automatic: false, reason: 'updater-unavailable'`; the `unsupported-headless-serve` test that asserts `automatic: true, reason: 'available'` (line 539-543) would then need updating to the same `updater-unavailable` shape, and the test at line 519-523 would need to assert `automatic: false, reason: 'updater-unavailable'`. Then the in-scope `updater.test.ts:408` test would *also* start asserting the same value, eliminating the test/test disagreement that currently masks the regression. — evidence: `git diff 0d4e64bd4..HEAD -- apps/desktop/orca/src/main/updater.ts` shows lines 911-915 returning `automatic: true, reason: 'available'`; the `autoUpdaterInitialized` flag is set to `true` at updater.ts:1459, before any external reader of `getRemoteServerUpdateSupport()`; both test files in this branch now assert mutually-exclusive values for what is supposed to be the same packaged interactive state. — criterion: 3.
  - INFO — Prior attempt-2 MAJOR (amend-chasing in git history): resolved cleanly. Reflog shows two fresh commits (64017a43e code + ed8599d10 gate) on top of the prior attempt's reset (HEAD@{2026-08-06 13:26:07}); no `commit --amend` operations on the rework branch. `resultSha: 64017a43e` binds to the code commit and is fixed.
  - INFO — Prior attempt-2 BLOCKER (headless-serve-install test regression): resolved. Re-ran `../../../tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/updater.headless-serve-install.test.ts src/main/updater.test.ts` and got `Test Files 2 passed (2) | Tests 22 passed | 7 skipped (29)`, matching the gate's `stdout` claim. But the resolution mechanism (re-ordering the function to expose a new fall-through) is itself the source of the new MAJOR above: criterion 3 was met by swapping which branch the test exercises, not by making the production path report the correct value.
  - INFO — Gate artifact binding: `node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-045-gate.json --result-sha=64017a43e363bdabe39b78d2c52df046392339e6` returns `VALID`. `resultSha: 64017a43e` correctly resolves to the code commit; the trailing commit `ed8599d10` only touches `docs/planning/evidence/DEVX-045-gate.json`, satisfying the walk-back rule.
  - INFO — `validate-task.mjs docs/coop/tasks/DEVX-045.md` returns `OK: DEVX-045 (ready, standard, 5 criteria)`.
  - INFO — Scope of files changed in `0d4e64bd4..HEAD` range: `apps/desktop/orca/config/electron-builder.config.cjs`, `apps/desktop/orca/src/main/updater.ts`, `apps/desktop/orca/src/main/updater.test.ts`, `apps/desktop/orca/src/main/updater.headless-serve-install.test.ts`, `docs/coop/tasks/DEVX-045.md`, `docs/planning/evidence/DEVX-045-gate.json`. All five code/docs files are in `scope.allow` (the worker's rework also touched `updater.headless-serve-install.test.ts` at line 518-521, which is in `scope.allow` per the task front-matter).
  - INFO — Prior `## Review (attempt 1)` and `## Review (attempt 2)` blocks remain unchanged; this review appends without overwriting, per the reviewer-skill's append-only policy. The disagreement is itself useful information: attempt 1 missed the headless-serve test regression (attempt 2 caught it); attempt 2 caught the regression but the rework overcorrected and re-opened the criterion 3 leak that attempt 1's `getRemoteServerUpdateSupport` discussion implicitly trusted.
- Acceptance check:
  - Criterion 1 (publish block): `apps/desktop/orca/config/electron-builder.config.cjs` `publish` block is gone; the config now ends with `npmRebuild: true`. `grep stablyai config/electron-builder.config.cjs` returns only the unrelated `appId = 'com.stablyai.orca'`. **PASS.**
  - Criterion 2 (setFeedURL + manual check): the `setFeedURL({ provider: 'generic', url: 'https://github.com/stablyai/orca/releases/latest/download' })` call inside `setupAutoUpdater` is deleted (the block at updater.ts:1451-1454 is now only the security comment). `checkForUpdatesFromMenu` (non-`localBuild`) sends `{ state: 'not-available', userInitiated: true }` directly (updater.ts:1238-1240). `checkForUpdates` delegates to `runBackgroundUpdateCheck` which sends `{ state: 'not-available' }` (updater.ts:1205-1213). New test at `updater.test.ts:433-447` asserts no `setFeedURL` / `checkForUpdates` calls. **PASS.**
  - Criterion 3 (packaged-build support): the production-path default branch now returns `automatic: true, reason: 'available'` (updater.ts:911-915), which is exactly the value the criterion says must NOT appear on a packaged build. The `!autoUpdaterInitialized` early-return that would otherwise hide this is dead in production. **FAIL → MAJOR (this review).**
  - Criterion 4 (no auto schedule): `scheduleAutomaticUpdateCheck` (updater.ts:967-975) is a no-op that clears the existing timer and sets it to `null`. `runBackgroundUpdateCheck` is reduced to a single `sendStatus({ state: 'not-available' })`. The startup path in `setupAutoUpdater` no longer calls either; only `checkForUpdateNudge` and the `powerMonitor.on('resume', ...)` / `app.on('browser-window-focus', ...)` listeners remain, and those only call `checkForUpdateNudge`. New test at `updater.test.ts:417-431` advances fake timers 30 days and asserts `autoUpdaterMock.checkForUpdates` is never called. **PASS.**
  - Criterion 5 (no test regression): re-ran the full updater suite, 22 passed + 7 skipped (29). No unrelated updater test regresses. **PASS.**

## Rework note (2026-08-06)

Dispatcher summary of attempt 2's rework verdict — resolve both, in one new
attempt:

1. **BLOCKER (criterion 5)**: `apps/desktop/orca/src/main/updater.headless-serve-install.test.ts`
   (already in `scope.allow`, no widening needed) has 4 failing tests
   (`:237-239`, `:311`, `:495-500`) because `getRemoteServerUpdateSupport()`
   now unconditionally returns `automatic: false` for every packaged build,
   including `installMode: 'interactive'`/`'supervised-headless-serve'`,
   which that file's tests still expect to report `automatic: true` and
   actually check for/download updates. Criterion 5 explicitly requires "no
   unrelated updater test regresses" — this is not unrelated, it is the
   live headless-serve upgrade path silently breaking. Fix
   `getRemoteServerUpdateSupport()` so the interactive/supervised-headless-serve
   install modes keep their existing update-check behavior, and only the
   `stablyai/orca` GitHub-feed path (the actual thing this task targets) is
   disabled. Update or add tests as needed; re-run the full
   `updater.headless-serve-install.test.ts` file and confirm 0 failures, not
   just the in-scope `updater.test.ts`.
2. **MAJOR (process)**: the previous attempt's git history had 8 sequential
   `commit --amend` operations chasing the gate artifact's `resultSha`
   toward HEAD, the exact anti-pattern `docs/coop/gate-artifact-v1.md` warns
   against (same failure mode previously seen on `DEVX-012`). Do not amend
   any commit in this worktree. For this rework: make exactly one new commit
   with the code fix, then exactly one further new commit that touches only
   `docs/planning/evidence/DEVX-045-gate.json`, with `resultSha` set to
   `git rev-parse HEAD` at the code commit — write it once, never re-stamp
   it afterward, even across multiple gate-command re-runs.
3. Note for context: because of the amend-chasing in point 2, the exact
   commit SHAs cited in `## Review (attempt 1)` and `## Review (attempt 2)`
   above no longer exist in this branch's linear history — both reviews were
   performed against snapshots that were later rewritten out from under
   them. Do not try to reconcile SHAs against those two review blocks; treat
   their *findings* (the BLOCKER and MAJOR above) as authoritative, not
   their cited hashes.

MINOR from attempt 1 (`pinDefaultReleaseFeed` dead code still hardcoding the
`stablyai/orca` URL, unreachable but fragile) — fix if small and contained
while already in this file; otherwise leave it and say so in the handoff,
per the original reviewer's own framing.

## Rework note 2 (2026-08-06) — attempt 5, root cause of the whack-a-mole

Three reworks in a row each fixed the previous review's finding and broke a
*different* sibling test file the declared gate never ran — because the
gate only ever covered `updater.test.ts` (plus a manually-added
`updater.headless-serve-install.test.ts`), while `apps/desktop/orca/src/main/`
has **10** `updater*`/`updater-*` test files. This is now fixed structurally,
not just patched again:

1. **Gate widened for good**: `scope.allow` and the declared gate command
   above now cover `updater.check-failure.test.ts` and, more importantly,
   the gate command changed from an enumerated single file to the directory
   prefix `src/main/updater` — vitest resolves this to all 10 files
   (verified directly: `Test Files ... (10)`). Do not narrow this back to a
   single file in this or any future attempt.
2. **The actual remaining failure**: `updater.check-failure.test.ts` (4
   tests, all in one `describe('updater check failure handling')` block) is
   *entirely* about the release-feed check-failure path — `'checking'` →
   `'error'` transitions, the idle/benign-failure drop, and the
   consecutive-failure backoff — all of which assumed `autoUpdater.checkForUpdates()`
   gets called for the release feed and can fail. After this task's own
   change, that call never happens for the release feed at all (this task's
   entire point). These 4 tests assert behavior that is now categorically
   unreachable, not a regression to preserve. Delete the 4 tests (the whole
   file's only content), with a short comment/commit message explaining why:
   the release-feed failure-handling path they tested no longer exists
   because release-feed checking itself is disabled by this task. Do not
   invent a new assertion that keeps the file "passing" against nothing —
   remove it cleanly, matching how `pinDefaultReleaseFeed`'s own dead-code
   status was already documented earlier in this file's review history.
3. Re-run the full widened gate (`vitest run --config config/vitest.config.ts
   src/main/updater`) and confirm all 10 files show 0 failures (skips are
   fine, matches existing darwin-only skip pattern) before writing the gate
   artifact.
4. Same commit hygiene as before: one code commit, one separate gate-only
   trailing commit, no amends.
