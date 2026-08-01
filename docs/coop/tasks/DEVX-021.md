---
{
  "id": "DEVX-021",
  "title": "Fix five remaining isolated DEVX-013 signal findings: EISDIR handling, rate-limit defaults, a malformed loopback path, a real WSL test hang, and an unreliable log-path fallback",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/native-chat/transcript-watch.ts",
    "apps/desktop/orca/src/main/native-chat/transcript-watch-error.test.ts",
    "apps/desktop/orca/src/main/rate-limits/service.ts",
    "apps/desktop/orca/src/main/rate-limits/service.test.ts",
    "apps/desktop/orca/src/main/runtime/orca-runtime-files.ts",
    "apps/desktop/orca/src/main/runtime/orca-runtime-files.test.ts",
    "apps/desktop/orca/src/relay/rotating-log-writer.ts",
    "apps/desktop/orca/src/relay/rotating-log-writer.test.ts",
    "apps/desktop/orca/src/renderer/src/components/editor/monaco-content-sync.ts",
    "apps/desktop/orca/src/renderer/src/components/editor/monaco-content-sync.undo-history.test.ts",
    "docs/planning/evidence/DEVX-021-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-021.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-021-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/native-chat/transcript-watch-error.test.ts src/main/rate-limits/service.test.ts src/main/runtime/orca-runtime-files.test.ts src/relay/rotating-log-writer.test.ts src/renderer/src/components/editor/monaco-content-sync.undo-history.test.ts",
      "purpose": "Run this task's five affected test files, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-021 · Five unrelated, already-diagnosed signal findings

## Outcome

Five independent real bugs found by the `DEVX-013` triage are fixed. They
share no root cause and touch five unrelated subsystems — bundled into one
task because each is small, already diagnosed down to the exact behavior,
and none needs further investigation, not because they're related.

## Acceptance

- [ ] `src/main/native-chat/transcript-watch.ts`'s directory/EISDIR-style
      read error surfaces the friendly `"Transcript unavailable"` message
      (the 4th argument the test expects) instead of `undefined`, so the
      degraded-UX path actually fires cross-platform. See
      `transcript-watch-error.test.ts`.
- [ ] `src/main/rate-limits/service.ts`'s built request options no longer
      unexpectedly include `allowUsagePanelSupplement: false` (should default
      `true`) or a stray `networkProxySettings` value, across the Gemini,
      OpenCode Go, WSL-target and PTY-fallback cases `service.test.ts`
      exercises — this needs a real look at the default-options resolution,
      not a test-only patch.
- [ ] `src/main/runtime/orca-runtime-files.ts` has two independent fixes:
      (a) the "opens IPv4 loopback local POSIX terminal links" path produces
      a correctly-joined `absolutePath` — today it's missing a separator
      between the loopback prefix and the drive letter
      (`"//127.0.0.1C:\\Users\\...\"`), so `exists` wrongly reports `false`
      for a file that's actually there; (b) the "translates WSL temp
      artifacts before granting the exact path" test either no longer hits
      `vitest`'s 30s `testTimeout` (fixed the WSL-path-translation step so it
      doesn't try to reach real `wsl.exe`/filesystem state unavailable in
      this environment), or, if a real WSL host is genuinely required, the
      test is adjusted to skip/mock that dependency with the reason stated —
      worker's judgment, but do not leave a bounded 30-second hang unexamined.
- [ ] `src/relay/rotating-log-writer.ts`'s "leaves the original streams
      active when the log cannot be opened" safety fallback engages
      reliably: pointing the log path at a directory must synchronously
      report `active: false` (e.g. a `stat` check before opening) rather
      than depending on write-stream async error-event timing that can
      report `active: true` on this host. See `rotating-log-writer.test.ts`.
- [ ] `src/renderer/src/components/editor/monaco-content-sync.ts` forces LF
      line endings on the Monaco text model (independent of host OS) instead
      of inheriting whatever EOL Monaco defaults to, so saved content
      doesn't round-trip with unexpected `\r\n`. See
      `monaco-content-sync.undo-history.test.ts`.

## Non-goals

- Do not investigate any other file from the `DEVX-013` triage. The five
  (six, counting the two `orca-runtime-files.ts` bugs separately) fixes
  above are the complete scope.
- Do not refactor the surrounding modules beyond what each fix needs.
- Do not change behavior on macOS/Linux for any of these five files unless a
  fix is platform-neutral by nature (e.g. forcing LF affects all platforms
  equally, which is fine — the bug was Windows-specific, the fix doesn't
  need to be).
- If the WSL-translation test genuinely cannot be de-flaked without a real
  WSL host in under this task's budget, report that as a finding and leave
  it — do not burn the rest of the budget chasing one sub-case at the
  expense of the other four fixes.

## Sources and decisions

- `docs/planning/evidence/DEVX-013-triage.md` — all five findings, each with
  the specific wrong value observed and, where identified, the fix
  direction.
- `docs/planning/evidence/BASELINE.md` — compare against it, not green.

## Plan and test mapping

1. Fix `transcript-watch.ts`'s EISDIR handling; confirm
   `transcript-watch-error.test.ts`. Criterion 1.
2. Investigate and fix `rate-limits/service.ts`'s default-options
   resolution; confirm `service.test.ts`. Criterion 2.
3. Fix `orca-runtime-files.ts`'s loopback path join and the WSL-translation
   timeout; confirm both `orca-runtime-files.test.ts` cases. Criterion 3.
4. Fix `rotating-log-writer.ts`'s invalid-path detection; confirm
   `rotating-log-writer.test.ts`. Criterion 4.
5. Force LF in `monaco-content-sync.ts`; confirm
   `monaco-content-sync.undo-history.test.ts`. Criterion 5.
6. Run all five test files together, write
   `docs/planning/evidence/DEVX-021-gate.json` per
   `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. These five
fixes, together with `DEVX-015`, `DEVX-016`/`DEVX-020`, and `DEVX-017`, close
every signal finding the `DEVX-013` triage identified.
