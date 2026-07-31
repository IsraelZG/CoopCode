---
{
  "id": "DEVX-009",
  "title": "Detect stalled and looping agent sessions from scanned session data",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": ["DEVX-006"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/**",
    "docs/planning/evidence/DEVX-009-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-009.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-009-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    }
  ]
}
---

# DEVX-009 · Detect stalled and looping sessions

## Outcome

A read-only check reports, for a given worktree, whether its agent session is
progressing, stalled or repeating itself — so an unattended run can be stopped
on evidence instead of on a wall-clock guess.

## Acceptance

- [ ] Given a session whose last message (by `created_at`) is **more than 600
      seconds old**, the check reports `stalled` with the elapsed time and the
      last message id — regardless of that message's `role` or `finished_at`.
      600s is `HUNG_THRESHOLD_MS` from `coordinator.ts:75`, reused rather than
      invented so Crush dispatches are judged by the same clock as every other
      agent.
- [ ] Given a session whose last message has `role: 'assistant'` and
      `finished_at IS NULL`, and is older than 600 seconds, the check reports
      `in_flight_overdue` instead of `stalled`. This condition is **role-scoped
      to `assistant` on purpose**: see Sources for why checking `finished_at`
      on any role produces near-100% false positives on real data.
- [ ] Given a session with **3 or more consecutive `assistant` messages whose
      `tool_call.data.name` AND `tool_call.data.input` are both byte-identical**
      to the previous one, the check reports `looping` with the repeated name,
      a truncated input, and the run length. Matching on `name` alone is not
      sufficient — see Sources.
- [ ] Output is JSON on stdout and the process exits non-zero only on its own
      failure, never because a session was judged unhealthy; the verdict is
      data, not an exit code.
- [ ] Fixture-based tests cover one healthy, one stalled, one `in_flight_overdue`
      and one looping session, each built from a fixture database rather than a
      live agent. The looping fixture must include a run of 5+ *same-name,
      different-input* tool calls that does **not** trigger `looping` — that
      exact shape occurs 49 times in real data (see Sources) and is the
      concrete false-positive this task exists to avoid.

## Non-goals

- Do not stop, kill or restart any agent, dispatch or process.
- Do not write to any agent database.
- Do not add a background service, timer or daemon; this is a command that runs
  when something asks it to.
- Do not modify the coordinator's existing heartbeat warning
  (`coordinator.ts` warns and never auto-fails, deliberately).
- Do not build a UI.

## Sources and decisions

- Depends on `DEVX-006`, accepted (`docs/coop/tasks/DEVX-006.md`, merge
  `1d3cb465f`). The real schema it landed
  (`apps/desktop/orca/src/main/ai-vault/session-scanner-crush-parser.ts`) is
  `messages(id, session_id, role, parts, model, created_at, updated_at,
  finished_at, provider, is_summary_message)`; `parts` is a JSON array of
  `{type, data}`, with `type` observed as `reasoning`, `tool_call`, `finish`,
  `tool_result`, `text`. A `tool_call` part's `data` has `name` and `input`.
- Prior art for the threshold, reused rather than re-derived: the coordinator
  warns on a stale dispatch after `HUNG_THRESHOLD_MS = 10 * 60 * 1000`
  (`coordinator.ts:75`, `HEARTBEAT_INTERVAL_MIN = 5` in `preamble.ts:40` — the
  comment "heartbeat × 2" is literal) and never auto-fails, with the recorded
  reason that a slow-but-correct worker costs more as a false positive than a
  hung one does as a false negative. This task's `stalled` and
  `in_flight_overdue` thresholds are the same 600s, not a new number.
- **Load-bearing correction found while setting these numbers, from this
  project's own live `.crush/crush.db` (2620 messages, 23 sessions, queried
  2026-07-30):** `finished_at` is NULL for **100% of `role: 'tool'` messages
  (1508/1508) and `role: 'user'` messages (45/45)** — it is only ever
  populated on `role: 'assistant'` messages (1066/1067 non-null), by Crush's
  own schema design, not as a sometimes-set completion marker. Checking
  `finished_at IS NULL` against the last message *regardless of role*, as the
  original draft of this task's acceptance criteria did, would report
  `in_flight_overdue` on every session whose last message happens to be a
  `tool` row — which is most of them, including sessions 8–40 hours dead. The
  corrected acceptance criteria above scope the check to `role: 'assistant'`.
- **Second load-bearing correction, same query:** consecutive `assistant`
  messages calling the *same-named* tool are common and legitimate — the
  longest observed run is **18** consecutive `tool_call`s to the same tool
  name, with **distinct `input` every single time** (a worker reading many
  different files, running many different shell commands). Across all runs of
  length ≥4 in this dataset, **0 had identical input** and **49 had distinct
  input**. Matching on tool name alone, at any N a human would pick, has a
  demonstrated false-positive rate near 100% on real work. `looping` therefore
  requires identical `input`, not just identical `name`; N=3 is chosen because
  it is the smallest run length that could exist above the observed
  zero-identical-runs floor, giving margin without being large enough to let a
  real stuck loop run for many turns before it's flagged.
- The audits found no loop detection anywhere in Orca, OpenCode or the
  reference repositories, so there is no existing implementation to mirror
  (`docs/coop/DEVX-005-ingestion-profile-gap-matrix.md`).
- This task's code lives under `tools/`, so its tests run with plain `node`,
  not through the Orca suite. See `docs/planning/evidence/BASELINE.md`: that
  suite is already red and must not be used as this task's gate.
- Resolved: this check reads Crush only. All-agent coverage is a later,
  separate task if the state owner wants it — the acceptance criteria and the
  false-positive corrections above are specific to Crush's observed schema and
  do not necessarily hold for another agent's session format.

## Plan and test mapping

1. Build fixture databases for the four cases (healthy, stalled,
   `in_flight_overdue`, looping) plus the same-name-distinct-input
   false-positive fixture, and write the tests first, one per acceptance
   criterion.
2. Implement the check as a single command under `tools/`, reading only,
   using the 600s threshold and the identical-name-and-input looping rule
   exactly as fixed above — do not re-derive or adjust either without new
   evidence.
3. Run the declared gates and write
   `docs/planning/evidence/DEVX-009-gate.json` per
   `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. That owner
appends it without rewriting earlier attempts. This check is the input to a
future watchdog profile; do not build the watchdog agent inside this task.
