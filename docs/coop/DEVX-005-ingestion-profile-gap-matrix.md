# DEVX-005 · Ingestion & Profile Gap Matrix

**Base:** `99d83e35bd4baf441c8191bb482da68edc1b1c97`
**Scope:** Audit of spec-ingestion, agent-profile, automations, dashboard, and
OpenCode agent/subagent layer not inventoried by DEVX-001.

---

## 1. Re-classification of Contested DEVX-001 Entries

Three entries in `docs/coop/DEVX-001-orchestration-gap-matrix.md` require
re-classification because the cited evidence contradicts the original
assessment. This report records the correction; the DEVX-001 matrix itself is
preserved as integrated evidence (merge commit `d39dddcdf`).

### 1.1 Spec Decomposition Claim (DEVX-001:126)

**Original claim** (DEVX-001-orchestration-gap-matrix.md:126):

> Orca's `Coordinator` class supports spec decomposition, DAG-based dispatch,
> polling loop, convergence detection, and escalation handling.

**Counter-evidence** (`coordinator.ts:185-192`):

```
// Why: decomposition isn't implemented yet — tasks must be pre-created before
// run(); AI-driven decomposition is a future phase.
private async decompose(): Promise<void> {
    this.state.phase = 'decomposing'
    const existing = this.db.listTasks()
    if (existing.length === 0) {
      throw new Error(
        'No tasks found. Create tasks with orchestration.taskCreate before
running the coordinator.'
      )
    }
```

| Aspect | DEVX-001 Classification | Correct Classification | Evidence |
|---|---|---|---|
| Spec decomposition (text → tasks) | EXISTING | **GAP** | coordinator.ts:185-192 — stub, comment says "isn't implemented yet" |
| DAG-based dispatch | EXISTING | **EXISTING** | coordinator.ts:347-388 (dispatchReadyTasks), db.ts (createTask with deps) |
| Polling loop | EXISTING | **EXISTING** | coordinator.ts:146-152 (tick loop with sleep) |
| Convergence detection | EXISTING | **EXISTING** | coordinator.ts:204 (checkConvergence call in tick) |
| Escalation handling | EXISTING | **EXISTING** | coordinator.ts:266-303 (handleEscalation with circuit breaker) |

**Corrected summary:** The Coordinator supports DAG-based dispatch, polling,
convergence, and escalations — but spec decomposition is a stub. Tasks must be
pre-created via `orchestration.taskCreate` RPC before `run()` is called. The
claim that "decomposition" is supported was incorrect.

### 1.2 DEVX-023 (Overnight Window) and DEVX-042 (Overnight Inbox)

**DEVX-001 assessment:** Both classified as **UNCHANGED** (gap).

**Counter-evidence** (`apps/desktop/orca/src/main/automations/`):

| Primitive | Source File | Test File |
|---|---|---|
| Scheduled trigger (tick-based interval) | service.ts:65-77 | service.test.ts |
| Missed-run grace window | service.ts:194-195 | service.test.ts |
| Precheck gate before dispatch | precheck-runner.ts | precheck-runner.test.ts |
| Headless dispatch (no UI) | headless-dispatch.ts, service.ts:252-315 | service.test.ts |
| Output snapshot capture | headless-dispatch.ts:29-73 | hermes-cron-output.test.ts |
| Hermes cron output reconciliation | hermes-cron-output.ts | hermes-cron-output.test.ts |

| DEVX ID | DEVX-001 Classification | Correct Classification | Rationale |
|---|---|---|---|
| DEVX-023 | UNCHANGED (gap) | **PARTIAL** | Automations layer provides scheduled execution, missed-run grace window, and headless dispatch. Missing: budget/stop-condition policy, DAG-aware task selection, max-concurrent-workers cap, overnight window declaration. |
| DEVX-042 | UNCHANGED (gap) | **GAP** | No overnight inbox/digest exists. The automations layer dispatches individual runs but does not aggregate results, produce a morning digest, or surface a reviewer inbox. |

**Evidence of the gap within the partial:** The `AutomationService` evaluates
due runs on a timer and dispatches them, but there is no concept of a CoopCode
overnight window (declared max tasks, wall time budget, stop conditions per
`docs/coop/development-loop.md:160-173`). The missed-run grace window is a
single `missedRunGraceMinutes` field, not a policy engine.

### 1.3 DEVX-040 (CoopCode Dashboard)

**DEVX-001 assessment:** Classified as **UNCHANGED** (gap).

**Counter-evidence:** Orca has a live agent dashboard:

| Primitive | Source File | Test File |
|---|---|---|
| Agent Kanban board (attention/working/idle) | AgentKanbanBoard.tsx | — |
| Dashboard snapshot (agent cards with state) | dashboard-snapshot.ts:67-75 | — |
| Agent state-dot (working/blocked/waiting/done/idle) | dashboard-snapshot.ts:23 | — |
| Agent card (paneKey, task, repo, worktree, timestamps) | dashboard-snapshot.ts:25-65 | — |
| Pop-out IPC relay (ack/reveal) | AgentKanbanBoard.tsx:21-30 | — |

**Re-classification:** DEVX-040 from **UNCHANGED** (gap) → **PARTIAL**.

| Aspect | Status | What exists | What a task-lifecycle board still needs |
|---|---|---|---|
| Agent status columns | EXISTING | attention / working / idle buckets | — |
| Agent state per card | EXISTING | dotState (working/blocked/waiting/done/idle) | — |
| Task lifecycle columns | **GAP** | — | draft / ready / working / review / done (5 states from development-loop.md:73-85) |
| DAG dependency view | **GAP** | — | Visualize `depends_on` links between tasks |
| Budget tracking | **GAP** | — | Per-task wall time consumed vs budget, attempt count, rework count |
| Gate status | **GAP** | — | Per-task gate results (pass/fail/pending) |
| Reviewer assignment | **GAP** | — | Which reviewer has the task, review state |

**Trade-off recorded, not chosen:** Whether the task board should be projected
from the Orca orchestration DB (`OrchestrationDb.task`/`dispatch_contexts`) or
from a CoopCode-owned event log is an unresolved architectural decision. The
agent Kanban derives from live pane state (PTY-backed), while a task board
would derive from persisted task lifecycle records. These two sources may
diverge (e.g., a "dispatched" task whose agent terminal is idle). The
decision belongs to `DEVX-040` implementation, not this audit.

---

## 2. Spec → Task DAG Ingestion (DOC-001, DOC-002)

DOC-001 ("Gerar proposta de especificação") and DOC-002 ("Derivar DAG
validado") describe the pipeline from a product requirement to a validated,
executable task DAG. DEVX-001 inventoried the DAG execution infrastructure but
not how specs enter the DAG.

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Spec text → auto-decompose into tasks | `decompose()` stub — throws if no pre-created tasks | **GAP** | coordinator.ts:185-192 | — |
| Task pre-creation (manual) | `orchestration.taskCreate` RPC with spec, deps, parent, runId | **EXISTING** | orchestration.ts:983-1013 | orchestration.test.ts |
| Task DAG with dependency edges | `createTask` stores `deps`, `promoteReadyTasks` gates on completed deps | **EXISTING** | db.ts (createTask, promoteReadyTasks) | db.test.ts:182+, coordinator.test.ts |
| Run isolation (one Run = one spec) | `RunRow` with objective, home_database, consumer_generation | **EXISTING** | types.ts:40-50 | orchestration.test.ts |
| Coordinator binding per Run | `coordinator_handle` + `coordinator_pane_key` on Run | **EXISTING** | types.ts:44-45 | orchestration.test.ts |
| Objective field (carries spec text) | `RunRow.objective` stores the spec string for the run | **EXISTING** | db.ts (createRun) | orchestration.test.ts |
| Spec parsing → structured task extraction | No parser; spec is opaque string on Run, not decomposed | **GAP** | — | — |
| DOC-001: proposal generation | No proposal generation primitive | **GAP** | — | — |
| DOC-002: DAG validation (dependency cycles, budget feasibility) | No DAG validation beyond SQL foreign keys | **GAP** | — | — |

**Ingestion path today:**
```
1. Human/agent writes task specs manually
2. orchestration.taskCreate { spec, deps, run } → TaskRow in SQLite
3. Coordinator.run() → decompose() lists pre-created tasks
4. dispatchReadyTasks() → dispatches tasks with satisfied deps
```
There is no programmatic path from a product requirement document to a task
DAG. The `objective` field on `RunRow` stores the spec text but is never parsed.

---

## 3. Agent Profile & Routing Catalog (DEVX-022)

DEVX-022 requires agent profile selection by risk/cost. The co-located
`skills/coop-*` prompts define conceptual profiles (economical, deep/routine)
but do not carry machine-readable routing fields. OpenCode's agent/subagent
mechanism is the execution substrate.

| CoopCode Requirement | Orca/OpenCode Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Agent type detection (claude, codex, opencode, etc.) | `WellKnownAgentType` union (21+ types) | **EXISTING** | agent-status-types.ts:20-41 | agent-status-types.test.ts |
| Agent state tracking | `AgentStatusState` (working/blocked/waiting/done) | **EXISTING** | agent-status-types.ts:16-17 | agent-status-types.test.ts |
| Agent subagent lifecycle | `spawn_subagent` hook event | **EXISTING** | agent-hook-listener.ts:631 | agent-hook-listener.test.ts |
| Subagent model/snapshot | `AgentSubagentSnapshot` (id, agentType, model, description) | **EXISTING** | agent-status-types.ts:74-79 | — |
| Profile selection by risk/cost | No profile registry or mapping | **GAP** | — | — |
| Routing taxonomy (Lane / Stats / Delegate-when / Don't-delegate-when) | No routing fields in skill prompts | **GAP** | — | — |
| Capability-to-agent mapping | No capability registry for agent selection | **GAP** | — | — |
| Prompt assembly per profile | Conceptual only (skills/coop-dispatcher/SKILL.md:23-26) | **PARTIAL** | skills/coop-dispatcher/SKILL.md | — |

**Prior art (read-only, external):** `oh-my-opencode-slim` defines per-agent
Lane (quick/standard/high-risk), Stats (tokens/time spent), and delegation rules
("Delegate when" / "Don't delegate when") in
`src/agents/orchestrator.ts`. The CoopCode skills define similar concepts in
prose but have no structured equivalent.

**Routing fields the `skills/coop-*` prompts do not carry:**

| Field | Present in oh-my-opencode-slim | Present in CoopCode skills | Needed for DEVX-022 |
|---|---|---|---|
| Lane (quick/standard/high-risk) | Yes — per-agent `Lane` | Yes — prose in development-loop.md:27-34 | Yes |
| Stats (tokens, cost, time) | Yes — per-agent `Stats` | No — budget uses wall time | Yes |
| Delegate-when rules | Yes — structured conditions | No | Yes (for routing) |
| Don't-delegate-when rules | Yes — structured conditions | No | Yes (for routing) |
| Model/vendor | Yes — per-agent | No — "do not hardcode vendor/model" (dispatcher:26) | No (by design) |
| Capabilities required | No | Yes — task frontmatter `capabilities` | Yes |
| Risk class | No | Yes — task frontmatter `risk` | Yes |

**OpenCode agent/subagent layer as the mechanism for DEVX-022:**
OpenCode (`opencode` in `WellKnownAgentType`) supports subagent spawning via
the `task` tool and agent configuration via `agent.<name>` with `mode`,
`model`, `prompt`, and `permission` fields. The CoopCode profile catalog would
map `profiles.worker` and `profiles.reviewer` (from the task spec frontmatter)
to specific OpenCode agent configurations with appropriate permission sets.
This mapping does not yet exist.

---

## 4. Unattended / Scheduled Execution (DEVX-023, DEVX-042)

The automations layer (`src/main/automations/`) provides hermetic scheduled
execution for Hermes agent runs. It is not CoopCode-specific but provides
reusable infrastructure.

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Scheduled trigger (interval-based) | `AutomationService` with configurable `tickMs` | **EXISTING** | service.ts:65-77 | service.test.ts |
| Schedule presets (hourly/daily/weekdays/weekly/custom) | `AutomationSchedulePreset` | **EXISTING** | automations-types.ts:32 | — |
| Missed-run grace window | `missedRunGraceMinutes` with `skipped_missed` status | **EXISTING** | service.ts:194-195 | service.test.ts |
| Precheck gate (pre-dispatch validation) | `AutomationPrecheck` with command, timeout, exit code | **EXISTING** | precheck-runner.ts | precheck-runner.test.ts |
| Headless dispatch (no renderer required) | `HeadlessAutomationDispatcher` interface | **EXISTING** | headless-dispatch.ts | service.test.ts |
| Output snapshot capture | `createHeadlessAutomationOutputSnapshotBuffer` (256 KB cap) | **EXISTING** | headless-dispatch.ts:29-73 | hermes-cron-output.test.ts |
| Run target resolution (local + SSH) | `resolveAutomationRunTarget` with host/repo/path validation | **EXISTING** | run-target-resolution.ts | run-target-resolution.test.ts |
| Usage collection per run | `collectAutomationRunUsage` (Claude/Codex tokens + cost) | **EXISTING** | run-usage-collection.ts | service.test.ts |
| Overnight window declaration (max tasks, wall time, stop conditions) | No policy engine | **GAP** | — | — |
| DAG-aware scheduled execution | Automations are single-run; no DAG concept | **GAP** | — | — |
| Budget enforcement (max tasks, max wall time) | No budget primitive in automations | **GAP** | — | — |
| Stop-condition policy (approval, secrets, scope escape, merge conflicts) | No stop-condition engine | **GAP** | — | — |
| Overnight inbox/digest | No aggregation or morning digest | **GAP** | — | — |
| Concurrent worker cap in headless mode | No `maxConcurrent` in automations | **GAP** | — | — |

**What `development-loop.md:160-173` requires that automations does not provide:**

```text
Uma janela unattended declara:
- máximo de tasks e workers simultâneos;      ← GAP
- wall time, tentativas e reworks;             ← GAP
- comandos e destinos de escrita permitidos;   ← GAP (precheck is single-command)
- acesso de rede;                              ← GAP
- ações externas proibidas;                    ← GAP
- horário limite e política de preservação.    ← GAP
```

---

## 5. Task-Board Projection (DEVX-040)

The `AgentKanbanBoard` and `DashboardSnapshot` project live agent terminal
state. A CoopCode task board must project task lifecycle state — a different
data source.

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Agent Kanban columns | attention / working / idle buckets | **EXISTING** | AgentKanbanBoard.tsx:32-41 | — |
| Agent state dot | working / blocked / waiting / done / idle | **EXISTING** | dashboard-snapshot.ts:23 | — |
| Agent card data (task text, repo, worktree, timestamps) | `DashboardCard` with 15 fields | **EXISTING** | dashboard-snapshot.ts:25-65 | — |
| Agent ack/reveal IPC | Pop-out relay for ack/reveal | **EXISTING** | AgentKanbanBoard.tsx:21-30 | — |
| Task lifecycle columns (draft/ready/working/review/done) | No task-state projection | **GAP** | — | — |
| DAG dependency graph visualization | No dependency visualization | **GAP** | — | — |
| Per-task budget consumption | No budget tracking in dashboard | **GAP** | — | — |
| Gate status per task | No gate status projection | **GAP** | — | — |
| Review state per task | No review assignment display | **GAP** | — | — |
| Worker assignment per task | `dispatch_contexts.assignee_handle` exists but is not in DashboardCard | **GAP** | — | — |

**Data source divergence:** `DashboardSnapshot` is derived from live agent pane
state (PTY-backed, re-published "several times a second" per
dashboard-snapshot.ts:73). A task board would be derived from the orchestration
DB's `TaskRow`/`DispatchContextRow` tables, which are write-on-update
(persisted, not streaming). These sources can disagree: a task can be
`dispatched` in the DB while its agent terminal is `idle` (worker hasn't started
typing), or `done` in the terminal while the DB still shows `dispatched`
(lifecycle message not yet processed). The agent Kanban shows the former; a
task board would show the latter.

---

## 6. Summary

| Category | Existing | Gap | Partial | Notes |
|---|---|---|---|---|
| Spec → DAG ingestion | 4 | 5 | 0 | `decompose()` is a stub; spec parsing is absent |
| Agent profile & routing | 4 | 3 | 1 | Profiles exist as prose, not structure |
| Unattended / scheduled | 7 | 6 | 0 | Automations layer is rich but CoopCode-agnostic |
| Task-board projection | 4 | 6 | 0 | Agent Kanban ≠ task-lifecycle board |
| **Total** | **19** | **20** | **1** | |

**Re-classifications from DEVX-001:**

| DEVX-001 Entry | DEVX-001 Classification | DEVX-005 Classification | Δ |
|---|---|---|---|
| Spec decomposition (DEVX-001:126) | EXISTING | **GAP** (decomposition) / EXISTING (polling, convergence, escalations) | 1 EXISTING → GAP |
| DEVX-023 (overnight window) | UNCHANGED (gap) | **PARTIAL** (scheduled execution exists) | Gap severity reduced |
| DEVX-040 (CoopCode dashboard) | UNCHANGED (gap) | **PARTIAL** (agent board exists) | Gap severity reduced |

**Key finding:** DEVX-001 correctly identified that Orca lacks agent profile
selection and task-lifecycle dashboards, but understated what already exists:
the automations layer provides scheduled, headless execution with precheck
gates and output snapshots, and the agent Kanban provides a live view of agent
state. The spec decomposition claim at DEVX-001:126 was incorrect —
`decompose()` is a stub. The corrected baseline is 19 existing primitives
(not in DEVX-001's scope) and 20 gaps across the two new categories plus the
three re-classified entries.

**Critical gaps (blocking downstream tasks):**
1. Spec decomposition (blocks DOC-001/DOC-002) — no parser exists
2. Agent profile registry (blocks DEVX-022) — profiles are prose, not data
3. Overnight policy engine (blocks DEVX-023) — automations lack budget/stop-condition enforcement

---

## 7. Reproduction Commands

```bash
# Verify base SHA
git -C C:/Dev2026/worktrees/CoopCode/DEVX-005 rev-parse HEAD
# Expected: 99d83e35bd4baf441c8191bb482da68edc1b1c97

# Verify decompose() stub (lines 185-192)
powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-005/apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts' -Pattern 'decomposition isn.t implemented' | ForEach-Object { \$_.Line }"
# Expected: comment with "decomposition isn't implemented yet"

# Verify decompose() guard (lines 190-192)
powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-005/apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts' -Pattern 'No tasks found' | ForEach-Object { \$_.Line }"
# Expected: error message "No tasks found. Create tasks with orchestration.taskCreate..."

# Count automations source files
powershell -NoProfile -Command "(Get-ChildItem -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-005/apps/desktop/orca/src/main/automations' -Filter '*.ts' | Measure-Object).Count"
# Expected: 18+ files (source + test)

# Verify agent type list includes opencode
powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-005/apps/desktop/orca/src/shared/agent-status-types.ts' -Pattern 'opencode' | ForEach-Object { \$_.Line }"
# Expected: 'opencode' in WellKnownAgentType union

# Verify AgentKanbanBoard buckets
powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-005/apps/desktop/orca/src/renderer/src/components/dashboard-popout/AgentKanbanBoard.tsx' -Pattern 'attention.*working.*idle' | ForEach-Object { \$_.Line }"
# Expected: bucket label cases for attention, working, idle

# Verify dashboard snapshot contract
powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-005/apps/desktop/orca/src/shared/dashboard-snapshot.ts' -Pattern 'DashboardBucket.*DashboardCard' | ForEach-Object { \$_.Line }"
# Expected: type definitions for DashboardBucket and DashboardCard

# Validate task contract
node C:/Dev2026/worktrees/CoopCode/DEVX-005/tools/coop-dev/validate-task.mjs C:/Dev2026/worktrees/CoopCode/DEVX-005/docs/coop/tasks/DEVX-005.md
```

---

## 8. Risks

1. **DEVX-022 dependency:** This matrix feeds DEVX-022 (agent profile catalog).
   If the routing taxonomy from oh-my-opencode-slim is insufficient, DEVX-022
   must define its own schema before implementation can begin.
2. **Automations vs. CoopCode gap:** The automations layer is designed for
   single Hermes agent runs, not orchestrated DAGs. Reusing it for overnight
   CoopCode execution requires a policy layer that may exceed the automations
   architecture.
3. **Dashboard data source duplication:** Projecting a task board from the
   orchestration DB while the agent Kanban projects from live pane state creates
   two parallel dashboard surfaces. Consolidation is a product decision.
4. **Spec decomposition complexity:** Parsing natural-language specs into
   structured tasks with dependency inference is an AI problem, not a
   deterministic transform. The `decompose()` stub's comment ("AI-driven
   decomposition is a future phase") signals this was deferred intentionally.
