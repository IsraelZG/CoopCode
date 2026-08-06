---
{
  "id": "DEVX-048",
  "title": "OpenCode Sessions must list real per-worktree opencode serve instances, not a hardcoded global port nothing ever listens on",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-044"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/opencode-sdk/client.ts",
    "apps/desktop/orca/src/main/opencode-sdk/client.test.ts",
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts",
    "apps/desktop/orca/src/main/ipc/opencode-sdk.ts",
    "apps/desktop/orca/src/shared/opencode-sdk-types.ts",
    "apps/desktop/orca/src/renderer/src/components/opencode-sessions/**",
    "apps/desktop/orca/src/preload/index.ts",
    "apps/desktop/orca/src/preload/api-types.ts",
    "docs/planning/evidence/DEVX-048-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-048.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-048-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/opencode-sdk",
      "purpose": "Run this task's main-process tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-048 · List sessions from every worktree's own opencode serve, not one fixed port

## Outcome

`OpenCodeSessionsScreen` always shows "Cannot reach OpenCode / Connection
error" today, and it always will under the current design: its main-process
client (`main/opencode-sdk/client.ts:9-11`) hardcodes
`http://127.0.0.1:54321` (overridable only via `OPENCODE_BASE_URL`), and
nothing in this app auto-starts an `opencode serve` on that port — that
design predates `DEVX-044`, which replaced the "one global serve" idea with
one `opencode serve` per worktree, on a port deterministically derived from
a hash of the worktree id (`OPENCODE_SERVE_PORT_RANGE_START` = 40000,
`pickOpenCodeServePort`), tracked in an in-memory registry
(`openCodeServes`, keyed by `worktreeId`) precisely so multiple worktrees can
each run their own dispatch in parallel without colliding on one process's
working directory. This task makes the sessions screen read from that real
registry — every worktree that currently has a live `opencode serve`, showing
which worktree each session belongs to — instead of a single fixed address
nothing has ever listened on in this app's actual architecture.

## Acceptance

- [ ] `listOpenCodeSessions` (or its replacement) enumerates every
      currently-registered per-worktree `opencode serve` from `DEVX-044`'s
      registry (`getOpenCodeServeForWorktree`-style access, or the
      equivalent exported enumeration) instead of connecting to a single
      hardcoded `OPENCODE_BASE_URL`/`54321`. Delete the fixed-port fallback —
      it is not a real target in this app's actual dispatch model, not a
      degraded mode worth preserving.
- [ ] Each session returned to the renderer carries which worktree/task it
      belongs to (worktree id and/or path), and `OpenCodeSessionsScreen`
      displays that alongside the session title/mode so a human can tell
      concurrent dispatches apart.
- [ ] When no worktree currently has a live `opencode serve`, the screen
      shows an honest empty state ("No active OpenCode dispatches" or
      equivalent) — reserve the error/"Cannot reach OpenCode" state for a
      registered serve that stops responding to a health check, not for the
      ordinary case of nothing being dispatched right now.
- [ ] Hands-on evidence: with a real `worker-start --agent opencode`
      dispatch live against a worktree (or, if none is live at review time, a
      fixture/mock-backed test proving the same enumeration-and-attribution
      logic, with the gap noted, not silently skipped), the screen shows
      that session correctly attributed to its worktree.

## Non-goals

- Do not keep `OPENCODE_BASE_URL`/the fixed-`54321` model as a fallback or
  additional mode. It is being replaced because it does not correspond to
  any real running process in this app, not supplemented.
- Do not add remote or cross-machine discovery. Read `DEVX-044`'s in-memory,
  same-process registry only — the same restriction `DEVX-044` itself
  already has for its own dispatch bookkeeping.
- Do not add controls to start, stop, or attach to a dispatch from this
  screen. Read-only, matching the restriction `DEVX-040`'s task board
  already has for the same reason (this is a visibility slice, not a control
  surface).
- Do not touch `DEVX-047`'s relocation of this screen out of the
  always-mounted overlay — that is separate, parallel work; coordinate the
  two diffs at review/merge time rather than one task absorbing the other's
  scope.

## Sources and decisions

- `apps/desktop/orca/src/main/opencode-sdk/client.ts:9-11` — the current
  hardcoded `getBaseUrl()`, the root cause of the permanent "Cannot reach
  OpenCode" state.
- `apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts`
  (`DEVX-044`, not yet integrated — worktree
  `C:\Dev2026\worktrees\CoopCode\DEVX-044`): `pickOpenCodeServePort`,
  `startOrReuseOpenCodeServe`, the in-memory `openCodeServes` map keyed by
  `worktreeId`, and `getOpenCodeServeForWorktree` — the real registry this
  task must read from instead of a fixed address.
- Decided 2026-08-05: ports are per-worktree, not per-dispatch, specifically
  so Coop's parallel-wave dispatch model (multiple tasks, each in its own
  git worktree, worked on simultaneously) is not serialized through one
  shared process bound to a single working directory — this is why a single
  global `opencode serve`/port was rejected as the fix, in favor of
  enumerating the real per-worktree registry.
- Observed directly 2026-08-05: a fresh CoopCode build's OpenCode Sessions
  screen showed "Cannot reach OpenCode / Connection error" with nothing
  running — confirmed this is not a build defect but the expected result of
  the screen's current design always targeting an address nothing occupies.

## Plan and test mapping

1. Confirm `DEVX-044`'s integration status before starting; this task is
   `blocked_on: ["DEVX-044"]` and cannot proceed against code that does not
   exist on `main` yet. Do not reimplement the registry independently.
2. Replace `client.ts`'s fixed-base-URL model with enumeration over
   `DEVX-044`'s per-worktree registry; extend `OpenCodeSdkListSessionsResult`
   (or introduce a small successor type) to carry per-session worktree
   attribution. Criteria 1 and 2.
3. Update `OpenCodeSessionsScreen` to group/label sessions by worktree and
   to render the new "nothing dispatched" empty state distinctly from a real
   connection failure. Criterion 3.
4. Capture hands-on evidence against a real or fixture-backed dispatch.
   Criterion 4.
5. Run the declared gates and write `docs/planning/evidence/DEVX-048-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
a screen that tells the truth about what's actually dispatched right now —
never a permanent, unconditional error for a target that was never real.

## Review (attempt 1)

- Reviewer: coop-reviewer (MiniMax-M3 via Crush)
- Date: 2026-08-06
- Result SHA reviewed: `5edb638a61c6998054bf6045067aea4092c1f001`
- Gate evidence commit: `b176f6444` (single file, the task's own gate JSON — resultSha binding valid)
- Decision: `accept`

### Findings

- INFO — `apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts` was modified in the result commit even though it was not in the original `scope.allow`. The diff is a 2-line addition of `listRegisteredOpenCodeServes(): OpenCodeServeHandle[]` (returning `Array.from(openCodeServes.values())`) sitting between the already-exported `getOpenCodeServeForWorktree` and `startOrReuseOpenCodeServe`. No equivalent registry-enumeration export existed before. This is exactly the user's stated exception ("precisou expor algo do registry que não era exportado"). The spec was retroactively amended in the result commit to add the file (and the new `client.test.ts`) to `scope.allow`; both additions are justified. Criterion: 1 (and gate runnability).
- INFO — `apps/desktop/orca/src/main/opencode-sdk/client.test.ts` is a new file not in original `scope.allow`. Same justification: required to satisfy acceptance criterion 4's "fixture/mock-backed test" branch and to make the declared vitest gate runnable against the new dependency-injected `listOpenCodeSessions`. Spec was retroactively amended; `OpenCodeServeHandle` was already exported (no re-export needed).

### Criterion verification

- Criterion 1 (registry enumeration, delete fixed-port fallback): PASS. `client.ts:12-45` no longer contains `getBaseUrl`/`54321`/`OPENCODE_BASE_URL`. `listOpenCodeSessions` iterates every `OpenCodeServeHandle` returned by `getServes()` (defaulted to `listRegisteredOpenCodeServes`). `grep` over `apps/desktop/orca/src` confirms no remaining `127.0.0.1:54321` reference in the opencode-sdk code path. The remaining `OPENCODE_BASE_URL` matches are in `main/rate-limits/opencode-go-*` and refer to `https://opencode.ai` (unrelated to per-worktree dispatch).
- Criterion 2 (per-session worktree attribution rendered): PASS. `shared/opencode-sdk-types.ts:13-14` adds optional `worktreeId`/`worktreeDir` to `OpenCodeSession`. `client.ts:28-32` attaches both from each `serve` handle. `OpenCodeSessionRow` (`OpenCodeSessionsScreen.tsx:13-25`) renders `worktreeId` as a `Badge` and `worktreeDir` as the secondary line, replacing the old `mode` line when attribution is present.
- Criterion 3 (honest empty state vs. real connection error): PASS. `client.ts:17-19` short-circuits to `{ sessions: [] }` (no error) when no serves are registered. `OpenCodeSessionsScreen.tsx:79-82` renders "No active OpenCode dispatches" for that case. Errors are now only emitted for serves that are registered but fail to respond (criterion 3's preserved case). Test 3 (`captures error when a registered serve fails to respond`) confirms the reserved semantics.
- Criterion 4 (hands-on or fixture-backed evidence, gap not silently skipped): PASS via the disjunct. No live `worker-start --agent opencode` dispatch was running at review time; the gate artifact and `client.test.ts` provide the fixture-backed branch and explicitly call out the gap in each gate entry's `detail` field. The three tests cover the empty-registry, multi-serve-enumeration, and serve-error branches — all three behaviors described by criteria 1–3.

### Gate re-verification (independent)

- `node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-048-gate.json` → `VALID`
- `rtk pnpm exec vitest run --config config/vitest.config.ts src/main/opencode-sdk` (from `apps/desktop/orca`) → `Test Files 1 passed (1) / Tests 3 passed (3)`, duration 540ms
- Gate-evidence commit `b176f6444` touches only the task's own `docs/planning/evidence/DEVX-048-gate.json` (73 insertions, 0 deletions); resultSha binding valid per the `validate-gate-artifact` schema.

### Test-quality note

The empty-registry test would have *failed* against the pre-change `client.ts` (which would have tried `127.0.0.1:54321` and returned `{ sessions: [], error: ... }` instead of `{ sessions: [] }`), so the new suite is a genuine regression test for criterion 3, not a tautology.

## Integration

- Review decision: `accept`
- Result SHA: `5edb638a61c6998054bf6045067aea4092c1f001`
- Merge commit: (this commit's parent — see git log)
- Gate: task/Gate Artifact validators and 3/3 opencode-sdk vitest suite (`exit 0`, local vitest fallback — pnpm-arm64.cmd unavailable, same pre-existing gap documented elsewhere).
- Note: `opencode-headless-dispatch.ts` was touched outside original scope.allow
  (2-line `listRegisteredOpenCodeServes()` export); review found this justified
  and the spec was retroactively amended by the worker. No further action needed.
