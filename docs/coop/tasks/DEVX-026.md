---
{
  "id": "DEVX-026",
  "title": "Apply DEVX-023 reviewer findings: immutable SQLite URI and dead-code cleanup in extract-candidates.mjs",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-023"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/corpus-learning/extract-candidates.mjs",
    "tools/corpus-learning/test-extract-candidates.mjs",
    "docs/planning/evidence/DEVX-026-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-026.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-026-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/corpus-learning/test-extract-candidates.mjs",
      "purpose": "Self-check of the extractor, including the new immutable-URI probe and the no-siblings invariant"
    }
  ]
}
---

# DEVX-026 · Apply DEVX-023 reviewer findings: immutable SQLite URI and dead-code cleanup

## Outcome

`tools/corpus-learning/extract-candidates.mjs` opens the corpus Crush
database in a way that provably never writes a `-shm` or `-wal` sibling next
to it, and the file's own dead code (an unused import, an unused local, an
unused parameter) is removed. The change is small, fully covered by the
existing self-check plus a live sibling-probe, and the 19 existing assertions
still pass.

## Acceptance

- [ ] In `tools/corpus-learning/extract-candidates.mjs` the SQLite database is
      opened via a `file:<absolute path>?immutable=1` URI rather than a bare
      path, so SQLite refuses to create a `-shm`/`-wal` pair when reading. The
      `DB_PATH` env var continues to accept an ordinary filesystem path and
      the script converts it to the URI before opening. A short comment in the
      source records the reason (the 757 MB corpus file at
      `C:\Dev2026\Docs\.crush\crush.db.bak` is the only copy of the history;
      even a 0-byte `-wal` next to it is a write we must never make).
- [ ] A new test in `test-extract-candidates.mjs` creates a tiny temporary
      SQLite database, opens it through the same code path the extractor uses,
      reads one row to prove it works, then asserts that the directory contains
      **zero** `-shm` and **zero** `-wal` siblings of the DB file before and
      after. The temp file is removed on both success and failure.
- [ ] All three pieces of dead code reported by the reviewer are removed: the
      unused `basename` import on line 3, the unused `s8` local in
      `extractFindings` (introduced and never read), and the unused `taskId`
      parameter on `buildCitation`. No call sites change behaviour, and the
      existing 19 assertions in the self-check all still pass.
- [ ] `docs/planning/evidence/DEVX-026-gate.json` is written and validates
      against `validate-gate-artifact.mjs`, with `resultSha` bound to the
      commit that contains the rework and `baseline` referencing the DEVX-023
      integration commit the rework is layered on.

## Non-goals

- Do not change the extractor's payload shape, marker parsing, or the
  citation contract. The DEVX-023 sample audit (24/24 faithful) still
  describes the same output.
- Do not touch `C:\Dev2026\Docs\`, the corpus, or any `.bak`/`.db` file
  outside `tools/corpus-learning/**`. The new test creates and deletes its
  own temp DB inside the system temp directory.
- Do not re-record the DEVX-023 sample audit, corpus inventory, or gate
  artifact. Those belong to the DEVX-023 attempt; DEVX-026 has its own
  artifact only.
- Do not fix unrelated debt in `extract-candidates.mjs` (e.g. a richer
  rework-round selector, multi-bullet capture). Surface those as follow-up
  findings instead.

## Sources and decisions

- Reviewer findings on attempt 1 of DEVX-023, recorded in the prior session
  and never applied: opening `crush.db.bak` with `node:sqlite` and
  `{ readOnly: true }` still creates a 32 KB `-shm` and a 0-byte `-wal` on
  the first connection in WAL mode. `file:<path>?immutable=1` is the
  documented SQLite URI flag that opens a database read-only **and** skips
  WAL/SHM entirely, so the connection cannot create the sibling files.
- `tools/corpus-learning/extract-candidates.mjs` — the file that needs the
  URI change and the three dead-code removals. Lines 3, 88–89, 232, 283 in
  the DEVX-023 integration commit `7fd55340` are the precise spots.
- `tools/corpus-learning/test-extract-candidates.mjs` — the existing 19
  offline assertions. They will be extended, not replaced.
- `docs/coop/gate-artifact-v1.md` — defines the `resultSha` binding and
  the `baseline` field the gate artifact must carry.
- The new test's temp DB lives in `os.tmpdir()`; both `node:sqlite`'s
  `DatabaseSync` and the sibling-probe use plain `node:fs`, so no new
  dependency is required.

## Plan and test mapping

1. Open the database via `file:${DB_PATH}?immutable=1` instead of a bare
   path; keep `DB_PATH` accepting the bare path so the offline self-check
   and any future automation can keep passing a path. Criterion 1.
2. Extend `test-extract-candidates.mjs` with: a `DatabaseSync` smoke test
   that opens a temp DB with the new code path, reads one row, asserts
   zero `-shm` and zero `-wal` siblings, then deletes the temp DB. The
   probe runs unconditionally — it does not depend on the offline env
   var setup used by the rest of the file. Criterion 2.
3. Drop the unused `basename` import, the unused `s8` local, and the
   unused `taskId` parameter; verify the 19 existing assertions still
   pass unchanged. Criterion 3.
4. Run the three declared gates; capture stdout, exit codes and timings;
   write `docs/planning/evidence/DEVX-026-gate.json` bound to the new
   result SHA. Criterion 4.

## Handoff

The worker returns the result SHA, the new gate artifact path, a one-line
summary of what changed in the source, and a note about whether the live
sibling-probe ran green. The reviewer confirms the URI change matches
`file:<abs>?immutable=1`, the three dead-code removals are clean, and the
existing 19 assertions plus the new sibling-probe all pass against the
result SHA. The integrator merges and updates `.context/plans/mvp.yaml`
 when they accept.

## Integration

- Review decision: `accept`
- Result SHA: `d7c8683a49883cf09e37c2cc7ede6062402e6bfa`
- Merge commit: `f210539fa`
- Gate: task/Gate Artifact validators and 30 extractor assertions (`exit 0`).
