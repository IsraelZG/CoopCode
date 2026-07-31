---
{
  "id": "DEVX-006",
  "title": "Read Crush sessions in the Orca ai-vault from the per-worktree SQLite database",
  "state": "done",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ai-vault/**",
    "apps/desktop/orca/src/shared/ai-vault-types.ts",
    "docs/planning/evidence/DEVX-006-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-006.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-006-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ai-vault/session-scanner-crush.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-006 · Read Crush sessions in the ai-vault

## Outcome

Crush sessions stored in `<worktree>/.crush/crush.db` are listed and readable in
the Orca ai-vault alongside the agents that already have scanners, so a dispatch
can be inspected without scraping terminal output.

## Acceptance

- [ ] `crush` is a member of `AI_VAULT_AGENTS`
      (`apps/desktop/orca/src/shared/ai-vault-types.ts:10`) and the project
      typechecks; `crush` already exists in `TUI_AGENT_CONFIG`
      (`apps/desktop/orca/src/shared/tui-agent-config.ts:174`), which the
      `satisfies readonly TuiAgent[]` constraint requires.
- [ ] A `crushDiscoveries(...)` function returns a `SessionFileDiscovery` with
      `agent: 'crush'` for every readable `<root>/.crush/crush.db`, and is
      spread into the registry in
      `apps/desktop/orca/src/main/ai-vault/session-scanner-source-discovery.ts:70-81`
      next to the existing agents.
- [ ] Listing the ai-vault on a machine with
      `C:\Dev2026\agentic-ide\.crush\crush.db` returns Crush sessions with
      title, created/updated timestamps, message count and token counts read
      from the `sessions` table; message content is read from `messages.parts`
      by its `type` discriminator, never by matching raw text.
- [ ] The scan is read-only and safe against a live writer: with
      `crush.db-wal` present and Crush running, a scan completes without error
      and without modifying `crush.db` or `crush.db-wal`
      (compare file hashes before and after); `crush.db-shm` is intentionally
      excluded because it is volatile WAL-index connection state (see ADR-0002).
- [ ] A `goose_db_version.version_id` other than the one this task was written
      against (`20260127000000`) produces an `AiVaultScanIssue` instead of a
      best-effort parse.

## Non-goals

- Do not implement stall or loop detection; that is `DEVX-009`.
- Do not change the dispatch→session binding in `runtime/orchestration`.
- Do not touch the OpenCode, Claude or Codex scanners.
- Do not write to the Crush database under any circumstance, including
  migrations, `VACUUM` or WAL checkpointing.
- Do not add a new SQLite dependency; `node:sqlite` is already in use.

## Sources and decisions

- Registry and spread point:
  `apps/desktop/orca/src/main/ai-vault/session-scanner-source-discovery.ts:70-81`.
- Contract to satisfy: `SessionFileDiscovery = { agent, rootDir, files }` and
  `SessionParseResult`, in
  `apps/desktop/orca/src/main/ai-vault/session-scanner-types.ts:67-76`.
- Pattern to mirror for a SQLite-backed source, including representing rows as
  synthetic file entries and splitting the virtual path back into a session id:
  `session-scanner-opencode-sqlite-discovery.ts:38-95`
  (`discoverOpenCodeSessions({ storageDir, dbPaths, limitPerAgent, issues })`,
  `splitOpenCodeSqliteCandidate`). Whether Crush reuses the SQLite worker
  thread (`session-scanner-opencode-sqlite-worker-*`) or reads inline is the
  worker's call; record the reason either way.
- Parser and cache dispatch by agent:
  `session-scanner-agent-parser.ts:47` and `session-scanner-parse-cache.ts:77`.
- Observed Crush schema on `C:\Dev2026\agentic-ide\.crush\crush.db`
  (19 sessions, 1051 messages, `goose_db_version.version_id = 20260127000000`
  applied 2026-07-29):
  - `sessions(id, parent_session_id, title, message_count, prompt_tokens,
    completion_tokens, cost, updated_at, created_at, summary_message_id, todos)`
  - `messages(id, session_id, role, parts, model, created_at, updated_at,
    finished_at, provider, is_summary_message)`
  - `parts` is a JSON array of `{ "type": ..., "data": ... }`; an observed
    entry is `{"type":"reasoning","data":{"thinking":"…"}}`.
- Discovery roots: Crush stores per project/worktree, unlike the agents already
  scanned, which store under the user home. Use the project and worktree roots
  the ai-vault scan options already carry; do not walk the filesystem broadly.
- `docs/planning/evidence/BASELINE.md` is the known baseline. The Orca suite is
  already red there; those failures are **not** your regression. Copy the
  commit and counts from that file into the Gate Artifact `baseline` field, and
  never run the full suite as a gate — the targeted command is declared above.
- Unresolved, for the state owner and not for the worker: the overnight policy
  in `docs/coop/policies/development-budget-v1.json` limits
  `allowed_write_destinations` to `docs/` and `tools/`. This task writes under
  `apps/desktop/orca/src/`, so it cannot run in an unattended window until that
  policy is revised. Dispatch it attended.

## Plan and test mapping

1. Add `'crush'` to `AI_VAULT_AGENTS` and typecheck — criterion 1. Run every
   command from `apps/desktop/orca` with
   `npm_config_virtual_store_dir_max_length=30` set, and record each command,
   its exit code and duration inside the Gate Artifact. A command that cannot
   be made to run is a blocker to report, not a criterion to drop.
2. Write the discovery for `<root>/.crush/crush.db` and register it — covered by
   a unit test over a fixture root, criterion 2.
3. Write the parser from `sessions` + `messages` into `AiVaultSession`, driven
   by the `parts` `type` discriminator — covered by a unit test over a fixture
   database built in the test, criterion 3.
4. Add a test that hashes `crush.db` and `crush.db-wal` before and after a scan
   with a WAL present and a live writer, and asserts they are unchanged;
   `crush.db-shm` is excluded per ADR-0002 — criterion 4.
5. Add a test with a mutated `goose_db_version.version_id` asserting an
   `AiVaultScanIssue` and no sessions — criterion 5.
6. Run the declared gates, write `docs/planning/evidence/DEVX-006-gate.json`
   per `docs/coop/gate-artifact-v1.md`, and provide hands-on commands showing
   the real Crush sessions listed.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts. The Gate Artifact is required,
not optional: this is the first task in the queue to produce one, and its
absence is a rework. `DEVX-009` consumes this scanner and must not start before
this task is accepted.

## Integration

- Review decision: `accept`
- Result SHA: `c968b4bd4642330839d2edc972d7d0bf92e553fc`
- Merge commit: `1d3cb465f`
- Composition gate: task and Gate Artifact validators, 11 focused Vitest tests
  and the node/CLI/web TypeScript checks (`exit 0`).
