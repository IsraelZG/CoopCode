---
{
  "id": "DEVX-014",
  "title": "UI-fusion step 2, first slice: render live OpenCode sessions via @opencode-ai/sdk in a purpose-built React screen",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/package.json",
    "apps/desktop/orca/pnpm-lock.yaml",
    "apps/desktop/orca/src/main/opencode-sdk/**",
    "apps/desktop/orca/src/main/ipc/opencode-sdk.ts",
    "apps/desktop/orca/src/main/ipc/opencode-sdk.test.ts",
    "apps/desktop/orca/src/preload/index.ts",
    "apps/desktop/orca/src/preload/api-types.ts",
    "apps/desktop/orca/src/renderer/src/components/opencode-sessions/**",
    "apps/desktop/orca/src/renderer/src/App.tsx",
    "docs/planning/evidence/DEVX-014-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-014.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-014-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/opencode-sdk.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-014 · First slice of UI-fusion step 2

## Outcome

CoopCode renders a real, purpose-built React screen showing the live list of
sessions from a running `opencode serve` instance, fetched through
`@opencode-ai/sdk` — not an embedded OpenCode web UI, not a mock. This is the
thinnest end-to-end vertical slice of the ladder's step 2 (decision 08,
ticket 10): prove the wiring works before building out more screens.

## Acceptance

- [ ] `@opencode-ai/sdk` is added as a dependency of `apps/desktop/orca` and a
      main-process module wraps its client, pointed at a locally running
      `opencode serve` (base URL from existing config/env, default to the
      port already verified working in `docs/planning/evidence/BASELINE.md`).
- [ ] A typed IPC channel (following the existing per-domain pattern in
      `src/main/ipc/`, e.g. `ai-vault.ts`) exposes the live session list to
      the renderer through `src/preload`, with a unit test proving the
      handler returns parsed session data from a fixture/mocked server
      response — no live `opencode serve` needed in CI.
- [ ] A new renderer screen under
      `src/renderer/src/components/opencode-sessions/` calls that channel and
      renders the sessions using existing shadcn primitives and
      `STYLEGUIDE.md` tokens — no new ad hoc colors, spacing or typography.
      Wired into `App.tsx` following whatever pattern an existing comparable
      screen already uses (do not invent a new routing mechanism).
- [ ] If `opencode serve` is unreachable, the screen shows a clear,
      non-crashing empty/error state — this is the only error-handling
      requirement for this slice.
- [ ] Hands-on evidence: `opencode serve` running locally, the new screen
      shown listing at least one real session it returns, proving live data
      end to end.

## Non-goals

- No chat, session creation, or any write operation against OpenCode — read
  only, session list only.
- No SSH-remote or federated-host support. Assume `opencode serve` is local
  to the machine running CoopCode. Remote hosts are explicit future work, not
  a silently-dropped requirement.
- Do not touch the ai-vault session scanners (`DEVX-006`/`DEVX-007`) or their
  SQLite reading — this is a live API client, a different, independent path
  to the same underlying data.
- Do not replace or modify the existing agent Kanban dashboard
  (`AgentKanbanBoard.tsx`, `dashboard-snapshot.ts`) — unrelated, unaffected.
- Do not build steps 1 or 3 of the ladder, and do not build more screens than
  the one session-list screen. One proven slice, not the whole ladder.
- Do not decide the task-board data source here — that is ticket 14's
  resolution, already recorded, and applies to a future `DEVX-040`, not this
  task.

## Sources and decisions

- `.scratch/wayfinder/issues/10-ui-fusion-step-and-start-decision.md` —
  resolved 2026-07-31: step 2, start now, in parallel with `DEVX-011` and
  `DEVX-013`.
- `.scratch/wayfinder/issues/13-vision-single-runtime-vs-arm64-tui-gap.md` —
  resolved: OpenCode enters only via `serve`/SDK, never TUI. This task is the
  first concrete proof of that path.
- `.scratch/wayfinder/issues/08-ui-fusion-four-step-ladder-defined.md` — the
  ladder; Solid (432 files) vs. React (1253 `.tsx`) is why step 2 (purpose-
  built React over the SDK) was chosen over embedding OpenCode's own UI.
- `docs/planning/evidence/BASELINE.md` — `opencode serve` confirmed working
  natively on Windows ARM64, version `0.0.0-dev-202607281756`, `/global/health`
  green.
- `apps/desktop/orca/src/main/ipc/ai-vault.ts` and sibling files — the
  existing per-domain IPC file convention to follow for the new channel.
- `apps/desktop/orca/AGENTS.md` — `STYLEGUIDE.md` compliance for any UI work;
  no vague file/module names; cross-platform and SSH/folder-workspace
  considerations (the SSH case is explicitly out of scope above, not
  silently ignored).
- No existing `@opencode-ai/sdk` usage in this repo (`apps/desktop/orca/src`
  grep, 2026-07-31) — this is genuinely new wiring, not a reuse of
  something already half-built.

## Plan and test mapping

1. Add `@opencode-ai/sdk`, write the main-process client wrapper and its
   config (base URL). Criterion 1.
2. Register the IPC channel following the existing per-domain pattern, expose
   it via preload, write the fixture-backed unit test. Criterion 2.
3. Build the renderer screen with shadcn/STYLEGUIDE primitives, wire it into
   `App.tsx`, handle the unreachable-server case. Criteria 3 and 4.
4. Run `opencode serve` locally, capture hands-on evidence of the screen
   showing a real session. Criterion 5.
5. Run the declared gates and write `docs/planning/evidence/DEVX-014-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This task
 closing proves the wiring, not full UI-fusion — later screens (chat,
 diagnostics, whatever else step 2 needs) are separate tasks once this slice
 is accepted.

## Integration

- Review decision: `accept`
- Result SHA: `19e99d50d22264f3c5ace731760e009afb885f55`
- Merge commit: `e90af294c`
- Gate: task/Gate Artifact validators and 4 IPC tests (`exit 0`).
