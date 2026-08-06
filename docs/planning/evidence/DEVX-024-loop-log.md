# DEVX-024 loop log

Run: `devx024-25fbeffac2`
Started: 2026-08-06T12:53:33.140Z
Chunks total (candidates): 753 (3011 candidates, chunk size 4 as produced by `DEVX-023`)
Chunk size: 4

Status: **stopped (budget_exhausted)** — `max_tasks=10 reached (10 dispatches)`
Dispatches: 10
Processed (terminal done/failed): 9 failed worker-start, 1 dispatched-but-not-progressing

## What this run actually proves

This unattended run drove the loop through the **real** dispatch mechanism
`DEVX-024` requires — `tools/coop-dev/dispatch-task.mjs`'s
`orca orchestration task-create` + `orca orchestration worker-start --agent
opencode` — with **no `direct-*` execution, no bypass, and no other agent
type**. The chunk-runner (`tools/corpus-learning/chunk-runner.mjs`) created 10
real orchestration tasks and called `worker-start --agent opencode` for each.

The run then hit the exact stop condition this task's Handoff/Non-goals name:
the only running/deployed Orca build on this machine is
`C:\Dev2026\builds\coopcode\current` at commit `95472c1c5`, which was built
**before** `DEVX-044`'s headless opencode dispatch fix was integrated. That
build's `worker-start --agent opencode` therefore cannot launch a progressing
headless opencode session: it errors `runtime_unavailable` (9 chunks) or accepts
a dispatch that never advances past `input_accepted` with no heartbeat (1 chunk).
`DEVX-044`'s live end-to-end verification is still open, tracked as `DEVX-049`
(state `ready`). Per criterion 5 this is reported as a real finding about
`DEVX-044`'s fix, not quietly omitted.

## Per-chunk records

Task ids are the real ids returned by `orca orchestration task-create`;
dispatch ids are the real ids returned by `orca orchestration worker-start`.

### CHUNK-001
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_6503e938a4aa`
- session title: `-` (no opencode session created)
- start: 2026-08-06T12:53:33.178Z
- end: 2026-08-06T12:54:04.021Z
- duration: 31s
- outcome: failed
- candidate rules: none (dispatch did not progress)
- error: `worker-start` → `runtime_unavailable` (deployed build lacks DEVX-044)

### CHUNK-002
- dispatchId: `ctx_89e41644f89b`
- taskId: `task_93a7ea26561a`
- session title: `ctx_89e41644f89b`
- start: 2026-08-06T12:54:04.025Z
- end: 2026-08-06T12:54:10.852Z
- duration: 7s
- outcome: in_progress (dispatch accepted, then stopped by worker)
- candidate rules: none (session never progressed)
- error: dispatch stayed at `ready`/`input_accepted`, no heartbeat — the
  DEVX-044/DEVX-049 opencode headless dispatch gap; stopped via `worker-stop`

### CHUNK-003
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_57946034de39`
- session title: `-`
- start: 2026-08-06T12:54:10.855Z
- end: 2026-08-06T12:54:41.641Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-004
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_7568e9dab29f`
- session title: `-`
- start: 2026-08-06T12:54:41.643Z
- end: 2026-08-06T12:55:12.305Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-005
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_5aa57acd8cf4`
- session title: `-`
- start: 2026-08-06T12:55:12.308Z
- end: 2026-08-06T12:55:43.486Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-006
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_c564897604cd`
- session title: `-`
- start: 2026-08-06T12:55:43.489Z
- end: 2026-08-06T12:56:14.114Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-007
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_07bc5288feef`
- session title: `-`
- start: 2026-08-06T12:56:14.118Z
- end: 2026-08-06T12:56:44.928Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-008
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_00044161efe8`
- session title: `-`
- start: 2026-08-06T12:56:44.931Z
- end: 2026-08-06T12:57:15.572Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-009
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_0c37e65c689c`
- session title: `-`
- start: 2026-08-06T12:57:15.575Z
- end: 2026-08-06T12:57:46.261Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

### CHUNK-010
- dispatchId: `-` (worker-start rejected; task created)
- taskId: `task_cc275a63450f`
- session title: `-`
- start: 2026-08-06T12:57:46.264Z
- end: 2026-08-06T12:58:16.881Z
- duration: 31s
- outcome: failed
- candidate rules: none
- error: `worker-start` → `runtime_unavailable`

## Orchestration/dashboard evidence

`orca orchestration task-list --json` (run `run_1256430b3898`) shows the real
tasks created by this run, present in the orchestration DB and thus the Agent
Kanban surface: `task_6503e938a4aa` (CHUNK-001), `task_93a7ea26561a`
(CHUNK-002, status `dispatched`), and `task_57946034de39` … `task_cc275a63450f`
(CHUNK-003…010). The single dispatch that was accepted
(`ctx_89e41644f89b`) reached orchestration status `dispatched` with a created
agent terminal, but its worker stayed at `ready`/`input_accepted` with
`last_heartbeat_at = null` — it did not progress, which is the honest finding
to report about `DEVX-044`'s fix and the open `DEVX-049` live-verification gap.

## How to reproduce

```bash
# 1. Extract candidates (DEVX-023 produces 3011 across 753 chunks of 4)
node --no-warnings tools/corpus-learning/extract-candidates.mjs > cands.json

# 2. Run the loop for 10 chunks through the real dispatch path
node tools/corpus-learning/chunk-runner.mjs \
  --candidates cands.json \
  --chunks 10 --chunk-size 4 \
  --cli "C:/Dev2026/builds/coopcode/current/resources/app.asar.unpacked/out/cli/index.js" \
  --state tools/corpus-learning/.devx024/state.json \
  --log docs/planning/evidence/DEVX-024-loop-log.md

# 3. Self-check of the state machine and resumability
node tools/corpus-learning/test-chunk-runner.mjs
```

Correctness note: the deployed/running Orca must contain `DEVX-044`'s headless
opencode dispatch for chunks to progress and produce candidate rules. Until the
live fix is verified and deployed (`DEVX-049`), the loop legitimately stops at
`budget_exhausted` after the configured `max_tasks` dispatches, exactly as this
run did — it never falls back to a different agent and never fakes progress.