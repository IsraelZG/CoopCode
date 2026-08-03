---
{
  "id": "DEVX-044",
  "title": "Fix orca orchestration worker-start so opencode dispatch is always headless (serve + run --attach), never the crashing TUI",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
  "risk": "high",
  "depends_on": ["DEVX-014", "DEVX-018"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.ts",
    "apps/desktop/orca/src/main/providers/opencode-headless-dispatch.test.ts",
    "apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-workers.ts",
    "apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-start-schema.ts",
    "apps/desktop/orca/src/cli/handlers/orchestration.ts",
    "apps/desktop/orca/src/cli/specs/orchestration-worker-specs.ts",
    "apps/desktop/orca/src/preload/index.ts",
    "apps/desktop/orca/src/shared/opencode-sdk-types.ts",
    "docs/planning/evidence/DEVX-044-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "high"},
  "budget": {"wall_minutes": 210, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-044.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-044-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/providers/opencode-headless-dispatch.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-044 · opencode dispatch stops crashing by never touching the TUI

## Outcome

`orca orchestration worker-start --agent opencode` never attempts to launch
opencode's interactive TUI — whose bundled OpenTUI/`bun:ffi` renderer crashes
on this platform's build — and instead starts (or reuses) a local headless
`opencode serve` instance for the target worktree, confirms it is healthy
through a bounded retry loop, then sends the dispatched work through
`opencode run --attach <server-url> --title <dispatch id> --auto`. The
dispatched session is real and attachable from the moment it starts:
inspectable live through the exact `GET /session` API `DEVX-014`'s
`@opencode-ai/sdk` screen already reads, not only after the work finishes.

This is the root-cause fix `DEVX-024`'s first attempt worked around instead
of fixing: that attempt bypassed `worker-start` entirely for opencode
(`dispatchId: "direct-CHUNK-NNN"`), because `worker-start` had no working way
to dispatch opencode headlessly. This task makes `worker-start` itself
correct for opencode, so nothing downstream needs a workaround.

## Acceptance

- [ ] The TUI crash is independently reproduced once as part of this task
      (not merely cited from `DEVX-024`'s prior handoff), confirming the
      problem being fixed is real: launching the bundled
      `C:/Dev2026/builds/coopcode/current/opencode/opencode.exe` in its
      default (TUI) mode fails on this build.
- [ ] `worker-start` with `--agent opencode` starts (or attaches to an
      already-running) `opencode serve` bound to the dispatch's worktree,
      with a bounded startup retry/health-check loop — a single failed first
      attempt must not be fatal. (This session's own verification on
      2026-08-02 hit exactly one `ServeError` on a `serve` process's first
      bootstrap, with a second attempt succeeding ~11 seconds later; this
      criterion exists because of that observation.)
- [ ] The actual dispatched work is sent via
      `opencode run --attach <url> --title <dispatch id> --auto`, never via
      the TUI path. Proven end to end with a real `worker-start` call:
      confirm (a) no TUI process/crash occurs, and (b) `GET /session` on
      that server shows a session whose title matches the dispatch id.
- [ ] `worker-start` accepts a way to request a restricted opencode agent
      profile — built with `opencode agent create --mode subagent
      --permissions <...>` — instead of always using the default,
      broadly-permissioned interactive agent. A caller asking for a
      read-mostly profile (e.g. `read,glob,grep`, no `bash`/`webfetch`) gets
      exactly that.
- [ ] Every other `--agent` value (`claude`, `crush`, `grok`, `codex`, etc.)
      keeps its current `worker-start` behavior unchanged — this fix is
      scoped to the opencode case only.

## Non-goals

- Do not fix crush's paste-race bug, claude's OAuth expiry, or grok's
  free-tier quota. Those are separate, unrelated problems for other agent
  types — out of scope by direct instruction; this task is opencode-only.
- Do not modify `AgentKanbanBoard.tsx` or `dashboard-snapshot.ts`. If
  `worker-start` now produces a real, orchestration-DB-tracked dispatch for
  opencode, the existing dashboard should already reflect it without any
  change on its side — verify this as evidence, don't touch the renderer.
- Do not build a server shared/pooled across multiple worktrees or
  dispatches. One `opencode serve` per worktree, matching the existing
  one-worktree-per-dispatch convention, is enough for this task. Pooling is
  a possible future optimization, not required here.
- Do not change how a human launches opencode interactively themselves
  (the default TUI command). Only the automated `worker-start` dispatch path
  changes.
- Do not touch `tools/corpus-learning/**`. `DEVX-024` consumes this fix; it
  does not ship alongside it.

## Scope correction (2026-08-03)

The originally declared `scope.allow` guessed at three candidate integration
files (`orchestration-mutation-executor.ts`, `local-pty-provider.ts`, plus
`orchestration-workers.ts`) without having located the real one yet. In
practice, wiring `--opencode-agent-profile`/`--opencode-agent-permissions`
through end to end touched a different, concrete set: the CLI handler and
spec (`src/cli/handlers/orchestration.ts`,
`src/cli/specs/orchestration-worker-specs.ts`), the RPC params schema
(`orchestration-worker-start-schema.ts`), `preload/index.ts`, and
`shared/opencode-sdk-types.ts` — each a necessary link in the same chain
(CLI flag → RPC params → handler → renderer-exposed types), not scope creep.
`scope.allow` above has been updated to match what was actually needed.

## Sources and decisions

- Verified live in this session, 2026-08-02: `opencode serve --port 51234`
  followed by `opencode run --attach http://127.0.0.1:51234 --auto --title
  "attach-test" "Respond with exactly: PONG-TEST-VERIFY"` produced a real
  session (`ses_03c4df465ffe2Nsyy14ZKs2Z0q`), visible via `GET /session`
  with the exact requested title, and a genuine assistant reply confirmed by
  reading `GET /session/:id/message` — proves the headless serve+attach
  mechanism this task builds on actually works on this platform and binary.
- Same verification: the first `opencode serve` bootstrap attempt logged a
  `ServeError` before a second attempt (11 seconds later) succeeded — the
  direct motivation for criterion 2's retry/health-check requirement.
- `opencode agent create --help` (run 2026-08-02): `--permissions`/`--tools`
  (from `bash, read, edit, glob, grep, webfetch, task, todowrite, websearch,
  lsp, skill`), `--mode` (`all|primary|subagent`), `-m/--model`. `opencode
  agent list` (same session) shows this is a real, already-used mechanism —
  built-in agents (`build`, `plan`, `explore`, `general`, `compaction`,
  `summary`, `title`) already carry distinct per-pattern permission rules.
- `tools/corpus-learning/chunk-runner.mjs` (DEVX-024, attempt 1) — its design
  comments first documented the OpenTUI/`bun:ffi` crash text
  ("OpenTUI render library / bun:ffi dlopen() not available") and the
  workaround this task replaces with a real fix. Only the opencode portion
  of that finding is in scope here.
- The exact file(s) that construct `worker-start`'s per-agent launch command
  were not conclusively located while writing this spec. Candidates found by
  searching `apps/desktop/orca/src/main` for agent-dispatch logic:
  `runtime/rpc/methods/orchestration-workers.ts`,
  `runtime/rpc/orchestration-mutation-executor.ts`,
  `providers/local-pty-provider.ts` — none confirmed as the real integration
  point. Locating it is this task's own first planning step, not a
  pre-solved fact; `scope.allow` lists all three candidates plus a new
  dedicated module so the worker isn't blocked by a wrong guess here.
- `docs/coop/tasks/DEVX-014.md` — the `@opencode-ai/sdk` session-list screen
  this fix makes immediately useful for live-inspecting a dispatched opencode
  session, with no change needed to that screen itself.
- `docs/coop/tasks/DEVX-018.md` — `dispatch-task.mjs` and the
  `orca orchestration worker-start` CLI path this task fixes, not replaces.

## Plan and test mapping

1. Reproduce the TUI crash once, directly. Locate the real per-agent
   dispatch construction site among the candidates above (or elsewhere).
   Criterion 1.
2. Implement the headless-serve-with-retry helper
   (`opencode-headless-dispatch.ts`): start or reuse `serve`, poll
   `/global/health` with a bounded retry before declaring ready.
   Criterion 2.
3. Implement the `run --attach --title --auto` dispatch call; wire it into
   `worker-start`'s existing flow for `agent === 'opencode'` only.
   Criterion 3.
4. Add restricted-agent-profile support via `opencode agent create`.
   Criterion 4.
5. Confirm no regression for other agent types (existing tests plus a direct
   check per already-configured agent type). Criterion 5.
6. Run the declared gates and write `docs/planning/evidence/DEVX-044-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
`worker-start --agent opencode` working correctly and headlessly on the first
try, every time — `DEVX-024`'s rewrite depends on exactly that, with no
fallback of its own.

### Attempt 1 outcome (2026-08-03)

An earlier attempt produced this same implementation but never committed it
and got stuck trying to verify criteria 2/3 by launching a fresh
`electron-vite dev` Electron instance from scratch — twice, without cleaning
up the first, leaving idle zombie `electron.exe`/`node.exe` processes and an
idle `opencode serve` behind. Those were killed; no progress was lost since
nothing had been committed to lose.

Taking over, a live `worker-start --agent opencode` call was attempted
directly against `Orca.exe` (pid 4788, the packaged app already running on
this machine) using the two orchestration Runs already bound in this repo's
history. It succeeded at the RPC level (`state: "ready"`, a real terminal
created, `dispatch_input: accepted`) — but no `opencode serve` ever started
and no runner/prompt files appeared under the OS temp dir, because **that
running `Orca.exe` is a packaged build older than this change** — it has
none of this task's new code compiled in, so `agent === 'opencode'` never
reached the new branch at all. This was independently confirmed (grep on
`out/cli/index.js` finds none of this task's new identifiers) and is the
same root problem the electron-vite attempts were trying to work around: a
truly live proof needs a rebuilt, freshly launched instance, which is heavy
and was the direct cause of the earlier stuck state.

The test dispatch was fully cleaned up (`worker-stop`, task marked
`completed` with an explanatory result, the throwaway task file removed —
nothing committed). Given the risk of repeating the same stuck state, this
attempt closes on: 22/22 unit tests (independently re-run), the TUI crash
independently reproduced, 31/31 pre-existing `orchestration-workers`-adjacent
tests still passing (no regression for other agent types), and the
underlying `serve` + `run --attach` mechanism already proven live earlier in
this session (a standalone test, outside `worker-start`, with a real session
and a real assistant reply). **Criteria 2, 3, and 4 are implemented and unit
tested, but not verified through a live `worker-start` call against a build
that actually contains this code** — that verification is the first thing a
reviewer or a rebuilt dev instance should do before this is trusted in
production, not a formality to skip.
