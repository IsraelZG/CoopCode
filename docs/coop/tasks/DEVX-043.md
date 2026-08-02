---
{
  "id": "DEVX-043",
  "title": "Review a corpus-learning candidate rule next to its replayed source citation, in-app, with a durable verdict that never auto-writes to PITFALLS.md",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-023"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ipc/coop-learning-review.ts",
    "apps/desktop/orca/src/main/ipc/coop-learning-review.test.ts",
    "apps/desktop/orca/src/preload/index.ts",
    "apps/desktop/orca/src/preload/api-types.ts",
    "apps/desktop/orca/src/renderer/src/components/coop-learning-review/**",
    "apps/desktop/orca/src/renderer/src/App.tsx",
    "docs/planning/evidence/DEVX-043-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-043.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-043-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-learning-review.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-043 · Replaying a citation in-app, instead of cross-referencing markdown by hand

## Outcome

A human reviewing a corpus-learning candidate rule (from `DEVX-023`'s
extractor or `DEVX-025`'s tool-usage report) sees the proposed rule text next
to its cited source, rendered from the real file at the real section — the
same cross-check this project's reviews have done by hand all session
(independently opening the cited task file or message id and confirming the
excerpt matches) — but as a repeatable in-app step instead of a one-off
manual audit. The human marks each candidate accepted, rejected, or pending;
that verdict is the only thing this task writes, and it never touches
`PITFALLS.md` or any skill directly.

## Acceptance

- [ ] Given `tools/corpus-learning/candidates.json` (produced by
      `extract-candidates.mjs`) or a report's structured candidate list (the
      six in `docs/planning/evidence/DEVX-025-tool-usage-report.md`), a
      screen lists each candidate's proposed rule text and its `citation`
      field (file, section, grep pattern).
- [ ] Selecting a candidate replays its citation: opens the cited file and
      locates the cited section (best-effort text search using the
      candidate's own stored section heading / grep pattern) so the human
      sees the original surrounding context, not only the extracted
      one-line excerpt.
- [ ] A human can mark each candidate `accepted` / `rejected` / `pending`.
      Verdicts persist to a local file (e.g.
      `docs/planning/evidence/<source-task>-candidate-verdicts.json`) — this
      task never writes to `C:\Dev2026\Docs\PITFALLS.md`, any project's
      skill files, or `agentic-ide`'s own
      `docs/coop/tool-usage-pitfalls.md` (`DEVX-027`). Adoption stays a
      separate, deliberate human action outside this tool.
- [ ] Verdicts are durable: closing and reopening the screen preserves prior
      marks rather than resetting to `pending` — the same durability
      principle `DEVX-024`'s chunk-runner state already had to prove.
- [ ] Hands-on evidence: run against the real candidates already produced by
      `DEVX-023`/`DEVX-025` in this repo, replaying at least three real
      citations and confirming the rendered source text matches what the
      candidate claims — the same kind of spot-check performed by hand
      during `DEVX-025`'s review.

## Non-goals

- Never writes an accepted candidate into `PITFALLS.md`,
  `docs/coop/tool-usage-pitfalls.md`, or any skill. That adoption step stays
  a deliberate, separate human action, exactly as `DEVX-023`'s and
  `DEVX-025`'s own non-goals already required.
- Does not call a language model to generate new candidates. It reviews and
  replays candidates `DEVX-023`/`DEVX-025` already produced.
- Does not build `DEVX-024`'s dispatch loop or depend on it being finished —
  this task operates on already-emitted candidate files, regardless of
  whether the unattended loop itself is fully proven.
- Does not modify `DEVX-023`'s shipped output
  (`extract-candidates.mjs`, `candidates.json`, `fixtures/`) — reads from it,
  same restriction `DEVX-024` already honored.
- Does not build a generic citation-replay viewer for arbitrary file types
  beyond this project's own markdown task corpus and evidence reports.

## Sources and decisions

- `docs/coop/tasks/DEVX-023.md` — produces the citation-carrying candidates
  this task reviews; done, result SHA `707ffbc493c168885190eb9e5737372e482e8f42`.
- `docs/planning/evidence/DEVX-025-tool-usage-report.md` — the six
  tool-usage candidates, each already independently verified during that
  task's review (exact match on every cited message id and derived number),
  usable as this task's own hands-on-evidence fixture.
- `docs/coop/tasks/DEVX-027.md` — the destination for *accepted*
  tool-usage-layer candidates; this task reviews and marks verdicts, `027`
  is where the format lives once adopted. The two are complementary, not
  overlapping: `043` is the review/replay tool, `027` is the one-time
  adoption of `DEVX-025`'s specific six findings.
- This session's own review practice for `DEVX-013`/`DEVX-023`/`DEVX-025` —
  independently opening cited sources and confirming faithfulness — the
  direct precedent this task turns into a repeatable in-app feature.
- `apps/desktop/orca/src/main/ipc/opencode-sdk.ts` (`DEVX-014`) — the IPC +
  preload + renderer convention this task's new domain follows.

## Plan and test mapping

1. Write the candidate-list parser (handles both `extract-candidates.mjs`'s
   JSON shape and a report's structured candidate blocks) with fixture-
   backed tests. Criterion 1.
2. Implement citation replay (file open + best-effort section search).
   Criterion 2.
3. Implement verdict marking and durable persistence to a local JSON file.
   Criteria 3 and 4.
4. Build the renderer screen, wire into `App.tsx`. Criteria 1–4 (UI surface).
5. Capture hands-on evidence replaying three real citations from this
   repo's actual candidates. Criterion 5.
6. Run the declared gates and write `docs/planning/evidence/DEVX-043-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
a human reviewing candidates faster and more reliably than by hand — never
that a candidate got adopted automatically. Adoption into any `PITFALLS.md`
or skill remains a separate, explicit human decision outside this tool.
