---
{
  "id": "DEVX-012",
  "title": "Rotate crush.db after Orca incorporates all sessions, keeping a timestamped backup",
  "state": "done",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": ["DEVX-006"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ai-vault/**",
    "docs/planning/evidence/DEVX-012-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-012.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-012-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ai-vault/session-scanner-crush-cleanup.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-012 · Rotate crush.db after full incorporation

## Outcome

After Orca confirms every session from a `crush.db` has been persisted into the
ai-vault, the database is renamed to a timestamped backup and its WAL/SHM
siblings are removed, so Crush starts fresh on next launch without the worker
re-reading a growing multi-hundred-MB database on every scan.

## Acceptance

- [ ] A `rotateCrushDatabase(dbPath)` function renames `crush.db` →
      `crush.db.<ISO-timestamp>.bak`, deletes `crush.db-wal` and
      `crush.db-shm` when they exist, and returns the backup path or `null`
      when `crush.db` is absent or the Crush process is still running.
- [ ] Before rotating, the function checks whether a Crush process holds
      `crush.db` open (via `crush` in the process list whose working directory
      or command line references the same project root). If Crush is running,
      rotation is skipped and the caller receives `null` with a diagnostic
      `AiVaultScanIssue`.
- [ ] A `computeCrushRotationCandidates(scannedSessions, discoveries)`
      helper determines which `crush.db` files are safe to rotate: every
      session discovered from that DB must appear in the scanned sessions
      (matched by `sessionId`), and at least one full scan must have completed
      since the DB was last written.
- [ ] Rotation is atomic per-file: a partial failure (e.g. rename succeeded
      but WAL delete failed) leaves a diagnostic issue and does not attempt
      recovery — the backup is the safety net.
- [ ] The cleanup is opt-in via `AiVaultScanOptions.rotateCrushAfterScan` and
      disabled by default. When enabled, rotation happens at the end of a
      successful scan, after sessions are parsed and before the result is
      returned to the UI.

## Non-goals

- Do not touch the Crush process itself (no kill, no restart, no IPC).
- Do not rotate while Crush is running; skip and issue, never force.
- Do not delete backups automatically; retention is the user's responsibility.
- Do not add OS-specific process enumeration libraries; use `node:child_process`
  and platform-appropriate commands (`tasklist` on Windows, `ps` on Linux/macOS).
- Do not alter the OpenCode or any non-Crush cleanup path.

## Sources and decisions

- Crush scanner (completed by DEVX-006):
  `apps/desktop/orca/src/main/ai-vault/session-scanner-crush-discovery.ts`
- Scan orchestrator where rotation would be called:
  `apps/desktop/orca/src/main/ai-vault/session-scanner.ts:59-76`
  (`scanAiVaultSessions`). Rotation should be a post-scan step inside this
  function or a helper called from it.
- `AiVaultScanOptions` type:
  `apps/desktop/orca/src/main/ai-vault/session-scanner-types.ts:9-43`
- `AiVaultScanIssue` contract:
  `apps/desktop/orca/src/shared/ai-vault-types.ts:155-160`
- Current crush.db layout observed 2026-07-30:
  `C:\Dev2026\agentic-ide\.crush\crush.db` (19 sessions, ~1 MB).
  A separate session reached ~700 MB; large DBs make every scan expensive,
  which is the motivation for rotation.
- Process detection: Windows `tasklist /FI "IMAGENAME eq crush.exe" /FO CSV`
  returns the PID; Linux/macOS `pgrep -f crush` or `ps aux | grep crush`.
  Parse output, do not shell out to a third-party library.
- Decision pending: should rotation fire after *every* successful scan or only
  when the DB exceeds a size threshold? The task elects "every successful scan
  when opted in" because size alone doesn't capture staleness — a 50 MB DB with
  6-month-old sessions is as wasteful as a 700 MB one. The opt-in gate prevents
  surprising users who expect persistent local history.

## Plan and test mapping

1. Add `rotateCrushAfterScan?: boolean` to `AiVaultScanOptions` — criterion 5.
2. Implement `isCrushProcessRunning(projectRoot)` with platform-specific
   process enumeration — covered by a unit test that mocks child_process output,
   criterion 2.
3. Implement `rotateCrushDatabase(dbPath)` with rename + WAL/SHM cleanup —
   covered by a unit test over a temp directory, criterion 1.
4. Implement `computeCrushRotationCandidates(...)` — covered by a unit test
   with synthetic session lists, criterion 3.
5. Wire rotation into `scanAiVaultSessions` as a post-scan step — covered by an
   integration test that runs a full scan on a fixture crush.db and asserts the
   DB was rotated, criterion 5.
6. Add a concurrency test: simulate a Crush lock (file open) and assert rotation
   is skipped with an issue — criterion 2 cross-check.
7. Run the declared gates, write `docs/planning/evidence/DEVX-012-gate.json`,
   and provide hands-on commands showing a crush.db rotated on the real
   `C:\Dev2026\agentic-ide\.crush\crush.db`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. The Gate
Artifact is required. This task writes to the filesystem (rename/delete of
crush.db*), which is a capability the ai-vault module doesn't currently
 exercise — the reviewer must verify that no session data is lost and that the
 backup file is readable by `node:sqlite` after rotation.

## Integration

- Review decision: `accept`
- Result SHA: `1fa95236debd033f96637f5d4f76c7fe7ddc4f34`
- Merge commit: `f4738e8c3`
- Gate: task and Gate Artifact validators plus 27 focused cleanup tests (`exit 0`).
