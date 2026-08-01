---
{
  "id": "DEVX-024",
  "title": "Prove automated loop dispatch on real work: CoopCode processes the corpus-learning chunks unattended, with resumable state",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "high",
  "depends_on": ["DEVX-018", "DEVX-023"],
  "blocked_on": ["DEVX-018", "DEVX-023"],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/corpus-learning/**",
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

# DEVX-024 · Prove the loop on work that actually matters

## Outcome

CoopCode dispatches an agent repeatedly, unattended, and it grinds through
the corpus-learning chunks from `DEVX-023` — producing reviewed candidate
rules — without a human pasting a prompt between iterations. The corpus is a
deliberately good proof case: it is naturally chunkable, each chunk is
independently verifiable against cited sources, and a wrong result is
detectable rather than merely plausible. This is the first real test that the
dispatch path works for something other than a single hand-held task.

## Acceptance

- [ ] A chunk runner in `tools/corpus-learning/` keeps durable state across
      iterations: which chunks are pending, in progress, done, or failed, in
      a file that survives a crash or a machine restart. Re-running after an
      interruption resumes rather than restarting, and never processes the
      same chunk twice without being told to. Prove it by killing the runner
      mid-chunk and restarting it.
- [ ] The loop dispatches through `DEVX-018`'s `dispatch-task.mjs` path —
      real `orca orchestration task-create` / `worker-start` calls, real
      agent, real worktree. A simulated loop that calls a function directly
      instead of dispatching does not satisfy this criterion and must be
      reported as a failure to prove the thing, not as a pass.
- [ ] The loop stops on its own for every terminal condition, not just
      success: all chunks done, a chunk failing more than its retry limit,
      the budget's `max_tasks`/wall-clock ceiling reached, or a stop
      condition from `docs/coop/policies/development-budget-v1.json`
      (`secret_encountered`, `scope_escape`, `repeated_failure`,
      `budget_exhausted`). Silence must never be indistinguishable from
      progress — the log must show why it stopped.
- [ ] At least 10 chunks are processed in one unattended run, and
      `docs/planning/evidence/DEVX-024-loop-log.md` records for each: chunk
      id, dispatch id, start/end time, outcome, and the candidate rules it
      produced. A human reads this log afterward and can tell exactly what
      happened without re-running anything.
- [ ] Hands-on evidence that the run was genuinely observable while it
      happened: the dispatched agents appeared in Orca's existing Agent
      Kanban dashboard (`AgentKanbanBoard.tsx` / `dashboard-snapshot.ts`),
      with a screenshot or snapshot dump. If they did not appear, that is a
      real finding about `DEVX-018`'s display-name wiring and must be
      reported, not quietly omitted.

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

## Sources and decisions

- `docs/coop/tasks/DEVX-023.md` — produces the chunked, citation-carrying
  candidates this loop consumes, and the sample-audit method that makes a
  chunk's output checkable rather than merely plausible.
- `docs/coop/tasks/DEVX-018.md` — the dispatch path this task exercises.
  Hard dependency: until `dispatch-task.mjs` calls Orca's real
  `task-create`/`worker-start`, there is no loop to prove, which is why this
  task is `draft` and `blocked_on` both.
- `apps/desktop/orca/src/shared/dashboard-snapshot.ts` and
  `src/renderer/src/components/dashboard-popout/AgentKanbanBoard.tsx` — the
  existing UI surface where dispatched agents already appear, and therefore
  where an unattended run becomes watchable without new UI work. What this
  will *not* show is Coop-specific state (gate results, budget consumed,
  attempt count) — that is the separate task board decided in wayfinder
  ticket 14 for a future `DEVX-040`.
- `docs/coop/policies/development-budget-v1.json` — `max_tasks`,
  `max_concurrent_workers`, `stop_conditions`, `prohibited_actions`. The
  loop must honour the stop conditions even though nothing enforces them at
  runtime today (see `DEVX-022`); this task is the first workload where
  they stop being decorative.
- Corpus scale measured 2026-08-01: 725 sessions / 115,170 messages in the
  historical `.bak`, 594 task files, 1010 `[M*]` + 569 `[B*]` findings —
  large enough that a loop is genuinely necessary and a single agent run
  could not do it, which is what makes it an honest test.

## Plan and test mapping

1. Build the chunk runner with durable state; kill and restart it mid-chunk
   to prove resumption. Criterion 1.
2. Wire it to `dispatch-task.mjs`; confirm real dispatch ids come back.
   Criterion 2.
3. Implement every stop condition and prove each one fires (force a
   repeated failure and a budget ceiling deliberately). Criterion 3.
4. Run at least 10 chunks unattended; write the loop log. Criterion 4.
5. Capture the dashboard evidence during the run. Criterion 5.
6. Write `test-chunk-runner.mjs` covering the state machine offline, run the
   declared gates, and write `docs/planning/evidence/DEVX-024-gate.json`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. A run that
stops early for a legitimate stop condition, logged and explained, is a
**pass** — the point is a loop that halts safely and visibly, not one that
runs to completion at any cost. Promote from `draft` to `ready` only once
`DEVX-018` and `DEVX-023` are both `done`.
