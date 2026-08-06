---
{
  "id": "DEVX-047",
  "title": "Stop floating the Coop Task Board and OpenCode Sessions cards over every screen; dock them into the app's real UI structure",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-040", "DEVX-014"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/renderer/src/components/coop-board/**",
    "apps/desktop/orca/src/renderer/src/components/opencode-sessions/**",
    "apps/desktop/orca/src/renderer/src/App.tsx",
    "apps/desktop/orca/src/renderer/src/lib/pane-manager/**",
    "apps/desktop/orca/src/renderer/src/components/tab-group/**",
    "apps/desktop/orca/src/renderer/src/components/terminal-pane/TerminalPane.tsx",
    "docs/planning/evidence/DEVX-047-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-047.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-047-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.renderer.config.ts src/renderer/src/components/coop-board src/renderer/src/components/opencode-sessions",
      "purpose": "Run this task's renderer tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-047 · The board and the sessions list stop floating over whatever screen is open

## Outcome

Today, `CoopBoardScreen` (`DEVX-040`) and `OpenCodeSessionsScreen` (`DEVX-014`)
are both unconditionally mounted in `App.tsx`'s render tree as a bare
`<Card className="mx-auto mt-8 ...">`, with no visibility gate at all —
confirmed by reading both files: neither has an early `return null`, unlike
`CoopLearningReviewScreen` (`DEVX-043`), which only renders once a
`coop-learning-review:open` window event fires. Because they render in every
`activeView`, in normal document flow, they visually appear in whatever empty
space happens to be left below the screen the user is actually looking at —
observed directly 2026-08-05 on the Automations screen, where both cards
appeared stacked in the middle of an otherwise-empty viewport. This closes
that gap: each screen is either a real, dockable pane in the app's existing
tab/pane-splitting system (`lib/pane-manager/`, `components/tab-group/`) or a
proper on-demand top-level view — not an always-on floating card no user
asked to see.

## Acceptance

- [ ] Investigate and document (in the Handoff) whether `lib/pane-manager/`'s
      tab/pane model is inherently scoped to one worktree's workspace (like
      terminal/editor/browser tabs already are) or can host a
      repo-root-scoped screen like the Coop Task Board without a worktree
      context. Pick the fit that matches how this app already surfaces
      non-worktree-bound utility screens (e.g. how `Settings`/`SkillsPage`
      are reached today) rather than forcing the board into a model it
      doesn't actually fit — state which was chosen and why.
- [ ] `CoopBoardScreen` and `OpenCodeSessionsScreen` are reachable on demand
      (a sidebar entry, a tab-open action, or a command — whichever fits the
      choice above) and are NOT mounted unconditionally in `App.tsx` for
      every `activeView` the way they are today.
- [ ] Each screen mounts only while genuinely open and unmounts when closed
      (matching how a terminal/editor tab already behaves, or how
      `CoopLearningReviewScreen` gates on its open event) — no residual
      always-present DOM node when not in use.
- [ ] Existing behavior is preserved with no functional regression: data
      fetch on open, the refresh button, loading/error/empty states all keep
      working exactly as before relocation.
- [ ] Hands-on evidence: a screenshot of the Coop Task Board actually open in
      its new home, showing normal use of the surrounding UI at the same
      time (e.g. a terminal pane still usable alongside it, or the sidebar
      still functional) — proving it no longer floats over unrelated
      screens.

## Non-goals

- Do not change `CoopLearningReviewScreen` (`DEVX-043`) — it already gates
  correctly on its own open event. Making its trigger mechanism consistent
  with whatever this task picks (sidebar entry vs. window event) is a nice
  bonus if trivial, not a requirement.
- Do not change the `coopBoard:listTasks` or `openCodeSdk:listSessions` IPC
  contracts, their main-process handlers, or preload surface. This is a
  renderer-only relocation.
- Do not build a generic "arbitrary widget in any pane" system. Solve this
  for these two screens using the narrowest change that fits the
  investigation above — do not add a plugin/registration API nobody asked
  for.
- Do not touch `AgentKanbanBoard.tsx` or `dashboard-snapshot.ts` — `DEVX-040`
  already drew this boundary and it still holds.

## Sources and decisions

- `apps/desktop/orca/src/renderer/src/components/coop-board/CoopBoardScreen.tsx:140`
  and
  `apps/desktop/orca/src/renderer/src/components/opencode-sessions/OpenCodeSessionsScreen.tsx:46`
  — both return a bare `<Card className="mx-auto mt-8 ...">` with no
  visibility gate.
- `apps/desktop/orca/src/renderer/src/App.tsx` — both screens mounted inside
  `RecoverableRenderErrorBoundary` blocks (`boundaryId="overlay.coop-board"`,
  `"overlay.opencode-sessions"`) unconditionally, alongside every other
  `activeView`.
- `apps/desktop/orca/src/renderer/src/components/coop-learning-review/CoopLearningReviewScreen.tsx`
  (`DEVX-043`) — the one existing screen in this same overlay stack that
  already gates correctly, via a `coop-learning-review:open` window event
  dispatched from a titlebar button in `App.tsx`. The precedent to match, if
  a window-event-gated overlay turns out to be the right fit instead of a
  pane.
- `apps/desktop/orca/src/renderer/src/lib/pane-manager/pane-manager.ts`
  (`PaneManager` class, `splitPaneAroundLeafIds`) and
  `apps/desktop/orca/src/renderer/src/components/tab-group/` — the real
  split/resize system this app already has for terminal/editor/browser tabs;
  the concrete candidate for "dock into a real column" the user asked about,
  pending the worktree-scoping investigation above.
- Observed directly 2026-08-05: opened a fresh CoopCode build, both cards
  appeared stacked mid-screen over the Automations view — the concrete
  motivating bug report for this task.

## Plan and test mapping

1. Read `pane-manager.ts`, `tab-group/tab-group-panel-split-target.ts`, and
   `terminal-pane/layout-serialization.ts` to determine whether a tab kind
   can exist outside a worktree-scoped workspace. Document the finding.
   Criterion 1.
2. Based on that finding, wire `CoopBoardScreen` and `OpenCodeSessionsScreen`
   into the chosen on-demand surface, removing their unconditional mount
   from `App.tsx`. Criteria 2 and 3.
3. Re-run each screen's existing tests (adjusted for the new mount point) to
   confirm no behavioral regression. Criterion 4.
4. Capture the hands-on screenshot evidence. Criterion 5.
5. Run the declared gates and write `docs/planning/evidence/DEVX-047-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
a user who can choose to look at the Coop Task Board or OpenCode Sessions,
not one who has them imposed over every other screen.

## Review (attempt 1)

- Reviewer: coop-reviewer (Gemini 3.6 Flash / Antigravity)
- Date: 2026-08-06
- Result SHA reviewed: `4b4374334421e95ef7265325da64760a4cec0798`
- Decision: `accept`
- Findings:
  - INFO — gate 3 command execution — task gate declared `tools/pnpm-arm64.cmd exec vitest ...`, but `tools/pnpm-arm64.cmd` is unavailable in this environment due to missing `.toolchains/`. The worker executed local `npx vitest run --config config/vitest.renderer.config.ts src/renderer/src/components/coop-board src/renderer/src/components/opencode-sessions` with identical config and target paths, passing 11/11 tests. This command deviation is acceptable and matches the pattern established in DEVX-040.


## Integration

- Review decision: `accept`
- Result SHA: `4b4374334421e95ef7265325da64760a4cec0798`
- Merge commit: `0b26184a1`
- Gate: task/Gate Artifact validators and 11/11 renderer vitest suite (`exit 0`).
- Real conflict with `DEVX-048` in `OpenCodeSessionsScreen.tsx` (047 branched
  before 048's honest-empty-state fix existed): resolved by keeping 047's
  docked-panel structure with 048's corrected "No active OpenCode dispatches"
  empty-state text, then fixing the one stale test assertion that still
  expected the old "No sessions found." copy (`a2a78ae7d`).
