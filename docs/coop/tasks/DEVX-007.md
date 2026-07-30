---
{
  "id": "DEVX-007",
  "title": "Make the ai-vault discover OpenCode sessions in the current on-disk database layout",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ai-vault/**",
    "docs/planning/evidence/DEVX-007-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-007.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-007-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ai-vault/session-scanner-opencode-sources.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-007 · Discover OpenCode sessions in the current layout

## Outcome

OpenCode sessions stored as loose `opencode*.db` files under the data directory
are discovered by the ai-vault even when the legacy `storage/` subdirectory does
not exist — or the report states, with evidence, that they already are and the
observation that prompted this task was wrong.

## Acceptance

- [ ] A test proves the discovery behavior when the data directory contains
      `opencode.db` and `opencode-dev.db` but has no `storage/` subdirectory,
      which is the layout observed on the Windows ARM64 host.
- [ ] If the current code already reaches the database leg in that layout, the
      report says so, cites the passing test, and the task closes without a
      production change.
- [ ] If it does not, the fix makes the SQLite leg reachable without widening
      the filesystem search and without changing the legacy JSON leg's
      behavior when `storage/` does exist.
- [ ] Sessions discovered this way are attributed to `agent: 'opencode'` and
      are not duplicated when both legs return the same session id.
- [ ] Hands-on evidence lists the real OpenCode sessions from the host's own
      databases, with the command used.

## Non-goals

- Do not change how OpenCode sessions are parsed once discovered.
- Do not add support for a new OpenCode storage location that no version
  actually writes to.
- Do not touch other agents' discoveries.
- Do not decide anything about the OpenCode web or SDK integration; this task
  is only about reading sessions that already exist on disk.

## Sources and decisions

- `apps/desktop/orca/src/main/ai-vault/session-scanner-opencode-sources.ts:9-12`
  builds `OPENCODE_STORAGE_DIR` as
  `join(process.env.OPENCODE_CONFIG_DIR ?? join(homedir(), '.local', 'share', 'opencode'), 'storage')`.
- `apps/desktop/orca/src/main/opencode-usage/scanner.ts:108-123`
  (`listOpenCodeDatabases`) matches files against
  `/^opencode(?:-[A-Za-z0-9_.-]+)?\.db$/` in the data directory.
- Observed on the Windows 11 ARM64 host on 2026-07-30:
  `C:\Users\<user>\.local\share\opencode\storage` does **not** exist, while
  `opencode.db` (172 KB) and `opencode-dev.db` (244 KB) do exist in
  `C:\Users\<user>\.local\share\opencode\`. Both file names match the regex
  above.
- The comment at `session-scanner-source-discovery.ts:71-73` records that
  OpenCode 1.17.x migrated from per-session JSON files to SQLite and that both
  legs run with dedup by session id — so the SQLite leg is expected to be the
  source of truth on current versions.
- `docs/planning/evidence/BASELINE.md` is the known baseline. The Orca suite is
  already red there; those failures are **not** your regression. Copy the
  commit and counts from that file into the Gate Artifact `baseline` field, and
  never run the full suite as a gate — the targeted command is declared above.
- This matters beyond tidiness: reading OpenCode sessions from disk is
  independent of how they were produced, so it is what keeps a future
  `opencode serve` integration observable without a PTY.

## Plan and test mapping

1. Write a failing-first test that builds a fixture data directory with the
   observed layout — two `opencode*.db` files, no `storage/` — and asserts the
   discovery returns the SQLite candidates. Criteria 1 and 2 or 3.
2. If the test passes unchanged, stop and report; the acceptance path is
   criterion 2.
3. If it fails, make the SQLite leg reachable in that layout and keep a second
   test covering the legacy layout with `storage/` present, asserting no
   behavior change. Criterion 3.
4. Add a dedup test with the same session id in both legs. Criterion 4.
5. Run the declared gates, write `docs/planning/evidence/DEVX-007-gate.json`
   per `docs/coop/gate-artifact-v1.md`, and record the hands-on listing.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts. A negative result — the code was
already correct — is a valid completion, provided the test that proves it is
committed.
