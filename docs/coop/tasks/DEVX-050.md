---
{
  "id": "DEVX-050",
  "title": "Prove a restricted opencode agent actually refuses a denied tool, dispatched through the real worker-start RPC path with title-matched session verification",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "high",
  "depends_on": ["DEVX-049"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts",
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.test.ts",
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.live.test.ts",
    "docs/planning/evidence/DEVX-050-gate.json"
  ]},
  "profiles": {"worker": "high", "reviewer": "high"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 2},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-050.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-050-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/providers/opencode-headless-dispatch.test.ts",
      "purpose": "Confirm no regression to the existing unit suite, from apps/desktop/orca"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/providers/opencode-headless-dispatch.live.test.ts",
      "purpose": "Run reproducible live verification against a real opencode serve, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-050 · Close the last real gap DEVX-049 disclosed: a live, refused, denied action

## Outcome

`DEVX-049` closed the load-bearing bug this whole chain exists to fix —
`opencode` is now resolvable and a real `opencode serve` genuinely starts and
answers health checks, live and reproducibly. What it could not close in
three attempts is the two acceptance criteria that were never really about
connectivity: that a session dispatched through the real `worker-start`
integration path is findable by its title (not just "some session exists"),
and that a restricted agent profile, when a real dispatched session actually
tries the denied action, is genuinely refused — not merely that its
frontmatter file contains `deny` lines. This task closes exactly those two,
narrowly, building on everything `DEVX-049` already proved works.

## Acceptance

- [ ] The live test dispatches through the same call chain
      `orchestration-workers.ts`'s `worker-start --agent opencode` RPC
      handler uses — `ensureOpenCodeAgentProfile` → `startOrReuseOpenCodeServe`
      → the real `opencode run --attach` spawn → `waitForOpenCodeDispatchSession`
      — not a hand-rolled shortcut that calls `startOrReuseOpenCodeServe` and
      stops at a health check. If routing through the literal CLI subprocess
      (`orca orchestration worker-start --agent opencode ...`) is achievable
      in this environment, prefer that; if not, document concretely why and
      route through the RPC handler function itself instead of its
      lower-level primitives in isolation.
- [ ] `waitForOpenCodeDispatchSession` (already exists,
      `opencode-headless-dispatch.ts:483`) is exercised for real: a session
      titled with a real, unique dispatch id appears in `GET /session` within
      its timeout, and the test asserts the returned `sessionId` corresponds
      to a session whose title equals the dispatch id used — not just that
      `Array.isArray(...)` holds.
- [ ] A session dispatched through a restricted profile
      (`read,glob,grep`, no `bash`/`webfetch`, matching `DEVX-049`'s captured
      `dx-resolver-auditor.md` shape) is sent a real prompt that can only be
      satisfied by a denied tool (e.g. asking it to run a shell command when
      `bash` is denied). Investigate what opencode's own serve API actually
      surfaces for this (session message/event endpoints, tool-call log,
      permission-denial event — whatever `opencode serve`'s real HTTP API
      exposes; do not assume a shape, confirm it against the real running
      server) and capture genuine evidence that the denied action did not
      execute and was refused by opencode's own permission system, not by
      this codebase re-implementing the check.
- [ ] If, after genuinely investigating, no reliable way exists in this
      environment to observe a clean refusal signal from outside the opencode
      process (e.g. it silently drops the request, or the only signal is
      buried in unstructured TUI-style output with no stable machine-readable
      marker), stop and report that finding precisely — do not fabricate a
      passing test around a weaker proxy (like re-checking the frontmatter
      file) and do not silently downgrade this criterion without saying so
      in the handoff. A `blocked` or `human` review verdict describing
      exactly what was tried and why it doesn't work is an acceptable,
      correct outcome for this specific criterion.
- [ ] The existing unit and live-test suites from `DEVX-049` still pass
      unmodified in spirit (adjusted only as this task's own changes
      require).

## Non-goals

- Do not touch `startOrReuseOpenCodeServe`, `isOpenCodeServeHealthy`, the
  vendored-binary resolver, or the `electron-builder.config.cjs` packaging
  fix — all proven working by `DEVX-049`; this task only adds the two
  criteria that were never about connectivity.
- Do not build a permanent CI job that re-runs this live verification on
  every change. One-time closure of a specific disclosed gap.
- Do not widen scope to any file outside `opencode-headless-dispatch.ts` and
  its two test files. If closing this genuinely requires touching
  `orchestration-workers.ts` or the CLI handler, stop and report that as a
  scope finding rather than silently expanding `scope.allow`.

## Sources and decisions

- `docs/coop/tasks/DEVX-049.md`'s `## Review (attempt 3)` and
  `## Human decision (2026-08-06)` sections — the exact findings this task
  closes, verbatim: criteria 2 and 4 not demonstrated by a live, reproducible
  dispatch; the decision to integrate DEVX-049's genuine progress and defer
  these two here rather than dispatch a 4th rework against the same budget.
- `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers.ts`
  (around lines 224-390) — the real `worker-start --agent opencode` RPC
  handler's call chain (`ensureOpenCodeAgentProfile` →
  `startOrReuseOpenCodeServe` → `waitForOpenCodeDispatchSession`); the
  integration seam this task's live test must actually exercise, not a
  narrower internal-function call as DEVX-049's attempt 3 did.
- `apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts:483`
  (`waitForOpenCodeDispatchSession`) — already implements title-matched
  session polling; DEVX-050 must exercise it for real, not add a new one.
- `.scratch/devx049-live/reverify/.opencode/agents/dx-resolver-auditor.md`
  (committed by `DEVX-049`) — the real restricted-profile shape already
  captured and verified against `openCodeAgentFileMatchesPermissions`; reuse
  this profile rather than re-capturing it.
- Budget set to `reworks: 2` (higher than this map's usual `1`) because
  `DEVX-049` demonstrated this specific kind of live-observability work
  genuinely needs more than one iteration even when each attempt makes real
  progress.

## Plan and test mapping

1. Read `orchestration-workers.ts`'s real `worker-start` handler chain before
   writing anything; confirm the exact integration seam to route the live
   test through. Criterion 1.
2. Extend the live test to assert `waitForOpenCodeDispatchSession`'s
   returned session's title against a real dispatch id, not just presence.
   Criterion 2.
3. Investigate opencode serve's real API for observing a tool-call
   refusal/denial; capture the real shape before writing an assertion around
   it. Criterion 3.
4. Dispatch a restricted session for real, send it a denied-tool request,
   capture the refusal (or the honest finding that it can't be observed).
   Criterion 3.
5. Run the declared gates and write `docs/planning/evidence/DEVX-050-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
either a real, reproducible refusal captured from outside the opencode
process, or an honest, precise report of why that isn't observable here —
never a test that passes by checking something weaker than what was asked.
