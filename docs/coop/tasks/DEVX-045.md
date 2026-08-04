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
