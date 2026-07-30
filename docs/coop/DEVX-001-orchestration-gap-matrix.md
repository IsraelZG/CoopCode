# DEVX-001 · Orca Orchestration Primitive x CoopCode Loop · Gap Matrix

**Base SHA:** `628c9218d56dc352a2a799fbceada88840bcb4ca`
**Date:** 2026-07-29
**Platform:** Windows 11 ARM64
**Orca snapshot:** `apps/desktop/orca` (imported, read-only audit)

---

## 1. Task State Machine

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| `draft` → `ready` → `working` → `review` → `done` | Task states: `pending`, `ready`, `dispatched`, `completed`, `failed`, `blocked` | **GAP** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:17` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |

**Gap:** Orca has no `draft`, `review`, or `done` states. `draft` is a CoopCode hardening phase (validate spec before ready). `review` is an independent inspection before integration. `done` requires confirmed integration. CoopCode needs to extend Orca's Task model or wrap it with an additional state layer.

**Existing coverage:** Orca tasks support `pending`, `ready`, `dispatched`, `completed`, `failed`, `blocked`. Tests in `orchestration.test.ts` cover task creation and status transitions. CLI handlers in `orchestration.ts:27-34` define the `TASK_STATUSES` array.

---

## 2. Dispatch / Attempt

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Attempt creation with base SHA, lease, budget | `WorkerDispatchState`: `starting` → `ready` → `succeeded`/`failed`/`stopped`/`abandoned` | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:93-102` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers-recovery.test.ts` |
| Retry of failed/stopped Dispatch | `--retry-of` flag with provenance checks | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/db.ts` (retry semantics) | `apps/desktop/orca/src/cli/handlers/orchestration.test.ts` |
| Attempt receipt (Dispatch ID + worker identity) | Worker dispatch state machine with stage receipts | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-start-receipt.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers-recovery.test.ts` |
| Budget enforcement (wall time, attempts, reworks) | No budget tracking | **GAP** | — | — |

**Gap detail:** Orca has no budget tracking: no wall-time limit per attempt, no attempt counter, no rework budget. CoopCode needs to add budget fields to the Task/Attempt model and enforce them at dispatch/review boundaries.

**Existing coverage:** Orca's `WorkerDispatchState` covers the full lifecycle from `starting` through terminal states. `WorkerDispatchRow` (types.ts:104-118) tracks stage, worktree, terminal handle, setup state, and effects. Recovery tests cover crash-before-effect, crash-after-possible-effect, and crash-after-durable-receipt scenarios.

---

## 3. Worktree Isolation

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| One worktree per writing task | `worker-start` with topology: current, existing, child, top-level | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-topology.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers-new-worktree.test.ts` |
| Worktree lifecycle (create, preserve, remove) | Worktree management via `worker-start` create, `worker-stop` preserves, `git worktree remove` | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |
| No network filesystem | Worktree on local disk only (Orca invariant) | **EXISTING** | Implicit in Orca's filesystem usage | — |
| Folder workspace support | `current`/`existing` folder worktree placement | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-folder-worktree-placement.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation-folder-placement.test.ts` |

**Existing coverage:** Orca's worker topology supports four modes with explicit conflict rejection. Agent-first worktree creation reuses the returned terminal handle. Setup options include `run`, `skip`, `inherit` with `start-immediately` and `wait-for-setup` policies.

---

## 4. Worker / Agent Supervision

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Launch agent in isolated terminal | `worker-start` with agent launcher requirement | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-start-schema.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers-new-worktree.test.ts` |
| Inject task preamble | `buildDispatchPreamble` with spec, base SHA, worktree info | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/preamble.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |
| Read worker output | `worker-read` with structured transcript support | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-output.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-output.test.ts` |
| Stop/abandon worker | `worker-stop` (fences lifecycle), `worker-abandon` (no remote action) | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-stop.ts` | `apps/desktop/orca/src/cli/handlers/orchestration.test.ts` |
| Worker reports completion | `worker_done` message with `outcome=succeeded|failed` | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.ts` (lifecycle reconciliation) | `apps/desktop/orca/src/cli/handlers/orchestration-lifecycle-rejection.test.ts` |
| TDD cycle (write failing test → implement → refactor) | No TDD orchestration | **GAP** | — | — |

**Gap detail:** Orca supervises agent terminals and accepts worker_done reports, but has no TDD cycle awareness. CoopCode needs the worker to follow a TDD flow (write test, see it fail, implement, refactor). This is primarily a worker-side convention, not a coordinator primitive. The gap is that no CoopCode worker skill/spec currently encodes this behavior.

**Existing coverage:** Worker lifecycle is comprehensively tested: setup combinations, terminal failure, task-input failure, stop/completion races, restart safety, process incarnation verification.

---

## 5. Evidence / Gate Artifact

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Gate Artifact JSON per attempt (task ID, attempt, base SHA, result SHA, platform, commands, exit codes, criteria results) | No Gate Artifact concept | **GAP** | — | — |
| Gate execution (allowlisted commands) | Gate type exists (`GateStatus`: `pending`, `resolved`, `timeout`) but no executable gate framework | **GAP** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:36` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-gates.ts` |
| Structured worker output as evidence | `worker-read` with Codex/Claude/Grok transcript reading + terminal fallback | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-output.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-output.test.ts` |
| Commit and diff as evidence | No commit/branch tracking (Orca non-goal) | **GAP** | — | — |

**Gap detail:** Orca has `GateStatus` as a type and `orchestration-gates.ts` for decision gate resolution, but it does not have a framework for executing allowlisted shell commands and recording their exit codes, output, and timing. CoopCode needs:
1. A Gate Artifact schema and generator
2. A gate executor that runs allowlisted commands in the worktree and captures structured results
3. Git commit/diff capture (explicitly excluded from Orca's scope per `ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md:54`)

**Existing coverage:** Orca's structured worker output reads agent transcripts (Codex, Claude, Grok) with exact session association, cursor chain integrity, source-change detection, and mixed-version federation fallback. This provides the raw evidence, but not the structured Gate Artifact format.

---

## 6. Review

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Independent reviewer agent | No review primitive | **GAP** | — | — |
| Accept / Rework / Blocked decision | No review decision structure | **GAP** | — | — |
| Review findings priority (criteria → regression → security → scope → tests → complexity) | No review policy encoding | **GAP** | — | — |
| Rework budget enforcement | No rework counter or limit | **GAP** | — | — |

**Gap detail:** Orca has no concept of independent review. The coordinator polls for completion but does not invoke a separate reviewer agent. CoopCode needs:
1. A reviewer role that inspects spec, complete branch diff, and Gate Artifact
2. A structured review decision (accept, rework with findings, blocked/escalate)
3. Rework budget enforcement (max 1 rework for routine, max 2 for high-risk)

---

## 7. Integration

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Serial integrator (merge approved branches) | No merge/integration primitive (Orca non-goal) | **GAP** | — | — |
| Base SHA revalidation before merge | No target-ref tracking (Orca non-goal) | **GAP** | — | — |
| Integration record | No integration state | **GAP** | — | — |
| `merge_ready` message type | `merge_ready` message type exists | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:5` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |

**Gap detail:** Orca explicitly lists "No commit, branch, merge, integration, or target-ref tracking" as a non-goal (`ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md:54`). The `merge_ready` message type exists but has no associated merge behavior. CoopCode needs:
1. A serial integrator that confirms base SHA is still current
2. Git merge execution with conflict detection
3. Integration state recording (integrated SHA, integrator identity, timestamp)

---

## 8. Run / Coordinator

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Run namespace (isolates tasks, mail, dispatches) | `RunRow` with ID, objective, home_database, consumer_generation | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:40-50` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-runs.ts` |
| Coordinator binding | `coordinator_handle` and `coordinator_pane_key` on Run | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:44-45` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |
| Consumer fencing (old coordinator cannot interfere) | `consumer_generation` increment on rebind, Delivery bound to generation | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:46` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-run-delivery-db.test.ts` |
| Coordinator loop (decompose → dispatch → monitor → converge) | `Coordinator` class with phases and polling | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |

**Existing coverage:** Orca's `Coordinator` class supports spec decomposition, DAG-based dispatch, polling loop, convergence detection, and escalation handling. The Run model isolates tasks, messages, deliveries, and questions. Consumer fencing prevents stale coordinators from acknowledging messages.

---

## 9. Dispatcher (Task Selection)

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Select next eligible task (dependencies satisfied, capabilities match, within budget) | Task DAG resolution in coordinator but no dependency-satisfaction check before dispatch | **GAP** | `apps/desktop/orca/src/main/runtime/orchestration/db.ts` (task CRUD) | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |
| Capability matching (repository-read, etc.) | No capability registry for tasks | **GAP** | — | — |
| Lane selection (quick / standard / high-risk) | No lane concept | **GAP** | — | — |
| Priority ordering | `MessagePriority`: `normal`, `high`, `urgent` for messages only | **PARTIAL** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:15` | — |

**Gap detail:** Orca's Coordinator decomposes a spec into tasks and dispatches them, but does not have:
1. A dependency-satisfaction check that verifies all `depends_on` tasks are `done` before dispatching
2. A capability registry matching task requirements to worker/machine capabilities
3. Lane awareness (quick/standard/high-risk) affecting dispatch and budget decisions

CoopCode needs at minimum: deterministic eligible-task selection based on `depends_on` resolution + `blocked_on` absence + budget remaining.

---

## 10. Messages / Mailbox

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| FIFO message delivery | FIFO mailbox with `DeliveryRow`, 50-message batch limit | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:54-62` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-run-delivery-db.test.ts` |
| Crash-safe acknowledgment | Whole-batch idempotent acknowledgment bound to consumer generation | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/db.ts` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-run-delivery-db.test.ts` |
| Worker questions / coordinator answers | Durable question state with timeout, resume, conflict rejection | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:64-78` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-mutation-question-db.test.ts` |
| Typed messages (status, dispatch, worker_done, escalation, handoff, decision_gate, question, heartbeat) | 9 message types | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:1-11` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration.test.ts` |

**Existing coverage:** Orca's mailbox is comprehensive: crash-safe delivery with consumer generation fencing, bounded batches, idempotent acknowledgment, typed timeout/cancelled/stale-delivery outcomes. Questions support idempotent first-answer recording, timeout resume, and conflicting-answer rejection.

---

## 11. Federation / Remote Workers

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Connect remote worker server | Saved environments with `--on` placement, `peer_fingerprint` pinning | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation.test.ts` |
| Remote Dispatch attachment | `RemoteDispatchAttachmentRow` with home peer, protocol version, capability hash | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:134-150` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation-effects.test.ts` |
| Bidirectional relay (home ↔ worker) | Contiguous sequence relay with quotas, heartbeat coalescing | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation-relay.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation-control-mail.test.ts` |
| Multi-machine capability mapping | No capability registry per machine | **GAP** | — | — |
| Disconnection recovery (lease expiry, idempotent retry) | Disconnect before send = no effect; after possible acceptance = unknown with dedupe | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation-effects.ts` | `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-federation-effects.test.ts` |
| No automatic worker replacement on silence | Explicitly enforced: silence alone never proves death | **EXISTING** | ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md:342 | — |

**Gap detail:** Orca's federation is mature (physical Mac↔Windows validation complete), but lacks a capability registry that maps machine identities to their capabilities (platform, architecture, tools, network access). CoopCode `DEVX-030` requires mapping machine capabilities for dispatch placement.

**Existing coverage:** Federation has been physically validated across Mac↔Windows and Windows↔Mac for start, completion, failure, question/reply, read, and stop. Restart recovery preserves attachments and relay state. Mixed-version capability negotiation returns `capability_unsupported` before effects.

---

## 12. Budgets and Overnight

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Wall-time budget per task | No budget tracking | **GAP** | — | — |
| Attempt and rework limits | No attempt/rework counters | **GAP** | — | — |
| Overnight window (max tasks, max concurrent, wall-time limit, allowed commands, network policy, stop time) | No overnight/unattended mode | **GAP** | — | — |
| Stop conditions (approval needed, secret, scope escape, merge conflict, unknown baseline, destructive migration, repeated failure) | No stop-condition policy engine | **GAP** | — | — |
| Coordinator heartbeat | `heartbeat` message type exists | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:10` | — |

**Gap detail:** Orca has no budget concept at all. `DEVX-004` requires versioned budget policy with:
- Per-task wall-time limit
- Max attempts per task
- Max reworks per task

Orca has no overnight/unattended window concept. `DEVX-023` requires a local overnight run with stop conditions for: human approval needed, secret encountered, scope escape, merge conflict, unknown baseline, destructive migration, repeated failure, or product/architecture question.

---

## 13. Learning / Trace → Proposal

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Trace-based learning proposals | No learning pipeline | **GAP** | — | — |
| Minimum 3 comparable attempts for a pattern | No pattern detection | **GAP** | — | — |
| Replay/eval against prior cases | No replay framework | **GAP** | — | — |

**Gap detail:** `DEVX-043` requires extracting learning proposals from execution traces, with a minimum of 3 comparable attempts before a pattern is considered, plus replay/eval against prior cases. Orca has no trace aggregation or pattern detection. This is a post-factory feature (Phase D4) and depends on `DEVX-023` (overnight runs producing sufficient traces).

---

## 14. Mutation Safety

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Idempotent request deduplication | `MutationReceiptRow` with caller fingerprint, request ID, payload hash, state | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/types.ts:80-91` | `apps/desktop/orca/src/main/runtime/rpc/orchestration-mutation-ledger.test.ts` |
| Payload mismatch detection | `request_mismatch` for same request ID with changed payload | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/orchestration-mutation-executor.ts` | `apps/desktop/orca/src/main/runtime/rpc/orchestration-mutation-ledger.test.ts` |
| Capability-based pane authority | Per-Dispatch unforgeable capability token | **EXISTING** | `apps/desktop/orca/src/main/runtime/rpc/orchestration-contract-fence.ts` | `apps/desktop/orca/src/main/runtime/rpc/orchestration-contract-fence.test.ts` |
| Filesystem permission enforcement | No read-only/writer enforcement (Orca non-goal) | **GAP** | — | — |

**Gap detail:** Orca has no filesystem permission enforcement. CoopCode tasks declare `scope.allow` paths, but there is no mechanism to enforce them at the filesystem level. This is a CoopCode requirement that Orca explicitly excludes.

---

## 15. CLI / Agent Interface

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| Task/run management CLI | `orca orchestration task-*`, `run-*`, `worker-*`, `send`, `check` | **EXISTING** | `apps/desktop/orca/src/cli/handlers/orchestration.ts` | `apps/desktop/orca/src/cli/handlers/orchestration.test.ts` |
| Agent skill documentation | `orca skills get orchestration` | **EXISTING** | `apps/desktop/orca/skills/orchestration/SKILL.md` | `apps/desktop/orca/src/renderer/src/lib/orchestration-skill-coverage.test.ts` |
| JSON output for agent consumption | `--json` flag on all orchestration commands | **EXISTING** | `apps/desktop/orca/src/cli/handlers/orchestration.ts` | `apps/desktop/orca/src/cli/handlers/orchestration.test.ts` |

**Existing coverage:** Orca's CLI provides `task-create`, `task-list`, `task-show`, `task-update`, `run-create`, `run-use`, `run-current`, `run-list`, `run-show`, `worker-start`, `worker-show`, `worker-read`, `worker-stop`, `worker-abandon`, `send`, `check`, `ask`, `reply`. Agent-facing documentation is served from the binary itself via `skills get orchestration`.

---

## 16. Database / Persistence

| CoopCode Requirement | Orca Primitive | Status | Source File | Test File |
|---|---|---|---|---|
| SQLite-based orchestration state | `OrchestrationDb` with schema creation, migration, permissions | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/db.ts` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-db-permissions.test.ts` |
| Run/task/message/dispatch persistence | Tables for runs, tasks, dispatches, messages, deliveries, questions, mutations | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/db.ts` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-version-skew-migration.test.ts` |
| Schema version skew handling | Migration framework with version tracking | **EXISTING** | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-schema-version-skew.ts` | `apps/desktop/orca/src/main/runtime/orchestration/orchestration-version-skew-migration.test.ts` |
| No separate scheduler database | Explicit non-goal: "No replicated Run database, leader election, or automatic Run-home failover" | **EXISTING** | ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md:59 | — |

---

## Roadmap Impact Analysis

### CORE-001 · Define coordinator/worker protocol

**Status:** **NARROWED.** Orca already has a working coordinator/worker protocol with federation (Phase 3). CoopCode should adopt Orca's protocol and focus CORE-001 on:
- Mapping CoopCode task states to Orca Task/Dispatch states
- Defining the TDD cycle within Orca's worker lifecycle
- Specifying how Gate Artifacts are produced by the worker

### CORE-002 · Register worker and capabilities

**Status:** **NARROWED.** Orca has saved environments and capability negotiation (`orchestrationFederationV1`). CoopCode needs to add a per-machine capability manifest (platform, architecture, tools available). CORE-002 should focus on this registry only, reusing Orca's saved-environment infrastructure.

### CORE-003 · FIFO queue with dependencies

**Status:** **NARROWED.** Orca has a FIFO mailbox and task DAG support. CoopCode needs to add dependency-satisfaction checking before dispatch. CORE-003 should focus on the eligibility check (`depends_on` all done + `blocked_on` empty), not a new queue.

### CORE-004 · Lease, heartbeat, expiration

**Status:** **NARROWED.** Orca has Dispatch state machine and heartbeat messages but no automatic expiration. CoopCode needs lease creation at dispatch time and heartbeat-based expiration. CORE-004 should focus on lease tracking, reusing Orca's Dispatch state machine.

### CORE-005 · Clone/worktree local

**Status:** **OBSOLETE.** Orca's `worker-start` already creates isolated worktrees with full topology options (current, existing, child, top-level). CoopCode should use Orca's worktree primitive directly. CORE-005 can be removed.

### CORE-006 · Supervise OpenCode session

**Status:** **OBSOLETE.** Orca's `worker-start` already launches agent terminals with preamble injection and lifecycle supervision. CoopCode can reuse Orca's worker lifecycle. CORE-006 can be removed.

### FLOW-001 · Execute task and produce diff/commit

**Status:** **UNCHANGED** in scope. Orca has no commit/diff tracking (explicit non-goal). CoopCode needs this. FLOW-001 must implement Git operations within the worktree: stage changes, produce diff, create commit.

### FLOW-002 · Execute gates of acceptance

**Status:** **UNCHANGED** in scope. Orca has gate types but no executable gate framework. FLOW-002 must implement allowlisted command execution with structured result capture.

### FLOW-003 · Register evidence and finalize attempt

**Status:** **UNCHANGED** in scope. Orca has worker lifecycle completion but no Gate Artifact. FLOW-003 must implement the Gate Artifact schema, generation, and storage.

### DIST-001 through DIST-005 · Multi-machine

**Status:** **NARROWED** significantly. Orca Phase 3 already provides:
- Connected server placement (DIST-001 partial)
- Remote dispatch and bidirectional relay (DIST-002 partial)
- Disconnection recovery with deduplication (DIST-003)
- Cross-platform federation (DIST-004)
- No merge integration (DIST-005 unchanged)

CoopCode should build DIST-001 through DIST-004 as thin wrappers over Orca's federation primitives. DIST-005 (branch integration) remains necessary as Orca does not do merges.

### DEVX tasks (D0–D4)

| DEVX ID | Assessment |
|---|---|
| DEVX-001 | This audit — in progress |
| DEVX-002 | **UNCHANGED.** Orca's Task states don't include `draft`/`review`/`done`. Schema must extend Orca's model. |
| DEVX-003 | **UNCHANGED.** Orca has no Gate Artifact concept. Full schema needed. |
| DEVX-004 | **UNCHANGED.** Orca has no budget/overnight concepts. Full policy definition needed. |
| DEVX-010 | **NARROWED.** Focus on dependency-satisfaction only. Reuse Orca's coordinator polling. |
| DEVX-011 | **NARROWED.** Orca already creates worktrees with branch, base SHA, and dispatch receipt. Focus on lease addition. |
| DEVX-012 | **UNCHANGED.** Orca has no executable gate framework or Gate Artifact generation. |
| DEVX-013 | **UNCHANGED.** Orca has no review primitive. Full reviewer agent needed. |
| DEVX-014 | **UNCHANGED.** Orca has no merge integration. Full integrator needed. |
| DEVX-020 | **NARROWED.** Orca supports `--retry-of` semantics. Focus on rework budget enforcement. |
| DEVX-021 | **NARROWED.** Orca has `blocked` task state. Focus on auto-resume when blocked_on clears. |
| DEVX-022 | **UNCHANGED.** Orca has no agent profile selection by risk/cost. |
| DEVX-023 | **UNCHANGED.** Orca has no overnight window concept. |
| DEVX-030 | **NARROWED.** Focus on capability manifest per machine. Reuse Orca's saved environments. |
| DEVX-031 | **NARROWED.** Focus on capability-based placement. Reuse Orca's federation dispatch. |
| DEVX-032 | **NARROWED.** Orca already handles disconnection idempotency. Focus on lease expiry recovery. |
| DEVX-033 | **UNCHANGED.** Orca does no merges. Full remote branch integration needed. |
| DEVX-040 | **UNCHANGED.** Orca has no CoopCode dashboard. |
| DEVX-041 | **UNCHANGED.** Orca has no preview system. |
| DEVX-042 | **UNCHANGED.** Orca has no overnight inbox. |
| DEVX-043 | **UNCHANGED.** Orca has no learning pipeline. |

---

## Summary

| Category | Existing | Gap | Partial |
|---|---|---|---|
| Task state machine | 1 | 1 | 0 |
| Dispatch/Attempt | 3 | 1 | 0 |
| Worktree isolation | 4 | 0 | 0 |
| Worker/Agent supervision | 5 | 1 | 0 |
| Evidence/Gate Artifact | 1 | 3 | 0 |
| Review | 0 | 4 | 0 |
| Integration | 1 | 3 | 0 |
| Run/Coordinator | 4 | 0 | 0 |
| Dispatcher (task selection) | 0 | 3 | 1 |
| Messages/Mailbox | 4 | 0 | 0 |
| Federation/Remote | 5 | 1 | 0 |
| Budgets/Overnight | 1 | 4 | 0 |
| Learning/Trace | 0 | 3 | 0 |
| Mutation safety | 3 | 1 | 0 |
| CLI/Agent interface | 3 | 0 | 0 |
| Database/Persistence | 4 | 0 | 0 |
| **Total** | **39** | **25** | **1** |

**Key finding:** The Orca snapshot provides 39 verified primitives across task management, dispatch, worktrees, worker lifecycle, mailbox, federation, mutation safety, and CLI. The 25 gaps concentrate in five areas: **review** (4 gaps), **budgets/overnight** (4 gaps), **evidence/gate artifact** (3 gaps), **integration** (3 gaps), and **dispatcher/task selection** (3 gaps). These align with CoopCode's D1 phase goals.

**Critical decision pending:** The filesystem scope enforcement (`scope.allow`) has no existing primitive in Orca and is explicitly excluded from Orca's scope. CoopCode must decide whether to implement filesystem enforcement at the worker level (chroot-like isolation), the agent level (instruction-only), or defer it.

---

## Reproduction Commands

```bash
# Verify base SHA
rtk git -C C:/Dev2026/worktrees/CoopCode/DEVX-001 rev-parse HEAD
# Expected: 628c9218d56dc352a2a799fbceada88840bcb4ca

# Count orchestration source files
rtk powershell -NoProfile -Command "(Get-ChildItem -Recurse -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-001/apps/desktop/orca/src' -Include '*orchestration*.ts' | Measure-Object).Count"
# Expected: 64+ files (source + test)

# Count orchestration test files
rtk powershell -NoProfile -Command "(Get-ChildItem -Recurse -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-001/apps/desktop/orca/src' -Include '*orchestration*.test.ts' | Measure-Object).Count"
# Expected: 27+ test files

# Verify task types include our needs
rtk powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-001/apps/desktop/orca/src/main/runtime/orchestration/types.ts' -Pattern 'TaskStatus|DispatchStatus|WorkerDispatchState' | ForEach-Object { \$_.Line }"
# Expected: type definitions for TaskStatus, DispatchStatus, WorkerDispatchState

# Verify federation is complete
rtk powershell -NoProfile -Command "Select-String -Path 'C:/Dev2026/worktrees/CoopCode/DEVX-001/apps/desktop/orca/ORCHESTRATION_IMPLEMENTATION_CHECKLIST.md' -Pattern '^-\s+\[x\]' | Measure-Object | ForEach-Object { \$_.Count }"
# Expected: 100+ completed checklist items
```

---

## Risks

1. **Orca state model mismatch:** CoopCode's `draft`/`review`/`done` states have no direct Orca equivalent. Extending Orca's schema requires version-skew migration compatibility.
2. **Filesystem enforcement:** No existing mechanism. If CoopCode requires filesystem-level `scope.allow` enforcement, this is a new subsystem.
3. **Orca version coupling:** CoopCode depends on Orca's orchestration RPC surface. Major Orca API changes could break CoopCode's integration layer.
4. **Testing gap:** Physical federation tests (Mac↔Windows structured output) remain partially incomplete per checklist lines 392-395.
