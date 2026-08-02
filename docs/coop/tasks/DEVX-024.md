---
{
  "id": "DEVX-024",
  "title": "Prove automated loop dispatch on real work, opencode only: CoopCode processes the corpus-learning chunks unattended through a real worker-start, with resumable state",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "high",
  "depends_on": ["DEVX-018", "DEVX-023", "DEVX-044"],
  "blocked_on": ["DEVX-044"],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/corpus-learning/chunk-runner.mjs",
    "tools/corpus-learning/test-chunk-runner.mjs",
    "docs/planning/evidence/DEVX-024-loop-log.md",
    "docs/planning/evidence/DEVX-024-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 240, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-024.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-024-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/corpus-learning/test-chunk-runner.mjs",
      "purpose": "Self-check of the chunk runner's state machine and resumability"
    }
  ]
}
---

# DEVX-024 · Prove the loop on work that actually matters, dispatching opencode for real

## Rework note (2026-08-02)

Attempt 1 produced real, valuable work — durable resumable state, a clean
`budget_exhausted` stop after 10 real chunks, 37 genuine candidate rules
extracted — but reviewed as **rework**, not accept. Its own criterion 2
explicitly anticipated and forbade exactly what shipped: every chunk
dispatched via `dispatchId: "direct-CHUNK-NNN"`
(`useDirectExecution: true`), a subprocess the chunk-runner spawned itself,
bypassing `orca orchestration worker-start` entirely. The reason was real —
`worker-start` had no working way to launch opencode headlessly on this
platform, and every other agent type (crush, claude, grok) had its own
independent failure or quota limit — but the loop-log itself never admitted
the gap in its own prose, and the dashboard evidence, read honestly, showed
the 10 dispatched tasks stuck at `status: "ready"` forever, never
progressing, because no `worker-start` had actually run for them.

This rewrite narrows scope to opencode only, per direct instruction, and
depends on `DEVX-044`, which fixes `worker-start` itself so opencode
dispatches headlessly and correctly. With that fix in place, this task no
longer needs any fallback, workaround, or "direct execution" path — every
chunk dispatches through the real, now-working mechanism.

## Outcome

CoopCode dispatches a real opencode agent repeatedly, unattended, through
Orca's own `orca orchestration worker-start --agent opencode` — and it
grinds through the corpus-learning chunks from `DEVX-023`, producing
reviewed candidate rules, without a human pasting a prompt between
iterations and without any bypass of the real dispatch path. Each chunk's
opencode session is headless, named, and inspectable live (via `GET
/session` or `DEVX-014`'s session-list screen) from the moment it starts —
not only after it finishes.

## Acceptance

- [ ] A chunk runner in `tools/corpus-learning/` keeps durable state across
      iterations: which chunks are pending, in progress, done, or failed, in
      a file that survives a crash or a machine restart. Re-running after an
      interruption resumes rather than restarting, and never processes the
      same chunk twice without being told to. Proven either by a real
      kill-and-restart or by an automated test that persists and reloads the
      real state-machine functions through an actual file round-trip (the
      approach attempt 1 already used and this review accepted as valid).
- [ ] Every one of at least 10 chunks dispatches through
      `tools/coop-dev/dispatch-task.mjs`'s real
      `orca orchestration task-create` + `worker-start --agent opencode`
      call — no `direct-*` execution, no bypass, no other agent type. If
      `worker-start` fails for a chunk, that failure is retried or reported
      as that chunk's own outcome, never silently swapped for a different
      execution path. Each chunk's opencode session is given a stable title
      (e.g. `CHUNK-NNN`, via `--title`) so it is findable afterward without
      cross-referencing dispatch ids by hand.
- [ ] The loop stops on its own for every terminal condition, not just
      success: all chunks done, a chunk failing more than its retry limit,
      the budget's `max_tasks`/wall-clock ceiling reached, or a stop
      condition from `docs/coop/policies/development-budget-v1.json`
      (`secret_encountered`, `scope_escape`, `repeated_failure`,
      `budget_exhausted`). Silence must never be indistinguishable from
      progress — the log must show why it stopped.
- [ ] At least 10 chunks are processed in one unattended run, and
      `docs/planning/evidence/DEVX-024-loop-log.md` records for each: chunk
      id, dispatch id, session title, start/end time, outcome, and the
      candidate rules it produced. A human reads this log afterward and can
      tell exactly what happened without re-running anything.
- [ ] Hands-on evidence that the run was genuinely observable while it
      happened: a dashboard/orchestration snapshot (`orca orchestration
      task-list --json`) showing the dispatched tasks actually progressing
      through real states — not stuck at `ready` the way attempt 1's did —
      plus confirmation the sessions appear in the Agent Kanban dashboard
      (`AgentKanbanBoard.tsx` / `dashboard-snapshot.ts`). If they still do
      not progress or appear, that is a real finding about `DEVX-044`'s fix
      and must be reported, not quietly omitted.

## Non-goals

- Do not adopt any extracted rule into `C:\Dev2026\Docs\PITFALLS.md` or any
  skill. This task proves the loop; adoption stays a human decision on
  reviewed candidates, exactly as in `DEVX-023`.
- Do not write to anything under `C:\Dev2026\Docs\`. Same read-only
  constraint as `DEVX-023`, for the same reason: the 757 MB `crush.db.bak`
  is the only copy of that history.
- Do not build automatic *selection* of which Coop task to dispatch. This
  loop iterates chunks of one known workload; it is not a general overnight
  scheduler, and building one is still gated behind the decision recorded in
  wayfinder ticket 11 / `DEVX-022`.
- Do not build a job queue, scheduler daemon, or retry framework beyond what
  this one workload needs. Durable chunk state in a file is enough.
- Do not extend the loop to dispatch across machines. Local only.
- Do not modify `tools/corpus-learning/extract-candidates.mjs`,
  `test-extract-candidates.mjs`, `audit-sample.json`, or anything under
  `tools/corpus-learning/fixtures/` — those are `DEVX-023`'s shipped output.
  Read/import from them if useful; do not edit them.
- Do not reintroduce grok, crush, or claude as fallback agents. Opencode
  only, per direct instruction — if opencode's real dispatch via
  `DEVX-044`'s fix is temporarily unavailable, that is a stop condition to
  report, not a reason to fall back to a different agent.
- Do not modify `DEVX-044`'s fix itself. Depend on it as a merged,
  already-working mechanism; do not reimplement or patch around it here.

## Sources and decisions

- Reviewed 2026-08-02: attempt 1's real, kept evidence — durable
  resumability (proven by an automated crash/restart test exercising the
  real `saveState`/`loadState` functions through an actual file round-trip),
  a correctly-explained `budget_exhausted` stop
  (`max_tasks=10 reached (10 dispatches)`), and 37 genuine candidate rules
  from 40 real corpus findings. None of that is discarded — this rewrite
  only replaces the dispatch mechanism.
- `docs/coop/tasks/DEVX-044.md` — the root-cause fix this task now depends
  on: `worker-start --agent opencode` dispatches headlessly via `opencode
  serve` + `run --attach`, with a retry/health-check loop and a restricted
  agent-profile option. Verified live in this session that the underlying
  serve+attach mechanism genuinely works and produces a real, inspectable
  session.
- `docs/coop/tasks/DEVX-023.md` — produces the chunked, citation-carrying
  candidates this loop consumes. Done; result SHA
  `707ffbc493c168885190eb9e5737372e482e8f42`.
- `docs/coop/tasks/DEVX-018.md` — `dispatch-task.mjs`, the CLI path this
  task calls, now correct for opencode once `DEVX-044` lands.
- `apps/desktop/orca/src/shared/dashboard-snapshot.ts` and
  `src/renderer/src/components/dashboard-popout/AgentKanbanBoard.tsx` — the
  existing UI surface where dispatched agents should now genuinely appear
  and progress, unlike attempt 1's stuck-at-`ready` result.
- `docs/coop/policies/development-budget-v1.json` — `max_tasks`,
  `max_concurrent_workers`, `stop_conditions`, `prohibited_actions`. Note
  `opencode run --auto` auto-approves permissions not explicitly denied
  (opencode's own CLI flags it "(dangerous!)"); this loop's stop conditions
  are the intended backstop for that, not a UI permission prompt that will
  never appear in headless mode.
- Corpus scale measured 2026-08-01: 725 sessions / 115,170 messages in the
  historical `.bak`, 594 task files, 1010 `[M*]` + 569 `[B*]` findings, 3011
  extractable candidates across 753 chunks of 4 — large enough that a loop
  is genuinely necessary, which is what makes it an honest test.

## Plan and test mapping

1. Confirm `DEVX-044` is merged and `worker-start --agent opencode` works
   headlessly end to end before writing any new chunk-runner code.
2. Reuse attempt 1's durable-state design (chunking, state machine,
   crash-resume test) — it was not the part reviewed as a defect. Criterion
   1.
3. Replace the dispatch call: every chunk now goes through
   `dispatch-task.mjs` → real `task-create` + `worker-start --agent
   opencode --title CHUNK-NNN`, no direct-execution branch at all.
   Criterion 2.
4. Re-verify every stop condition still fires correctly under the new
   dispatch path. Criterion 3.
5. Run at least 10 chunks unattended; write the loop log, including session
   titles. Criterion 4.
6. Capture dashboard/orchestration evidence proving real progression, not
   just presence. Criterion 5.
7. Run the declared gates and write `docs/planning/evidence/DEVX-024-gate.json`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. A run that
stops early for a legitimate stop condition, logged and explained, is a
**pass** — the point is a loop that dispatches for real and halts safely and
visibly, not one that runs to completion by substituting a different
mechanism than the one it was asked to prove.
