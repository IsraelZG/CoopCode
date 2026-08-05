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
    "apps/desktop/orca/src/main/ipc/register-core-handlers.ts",
    "apps/desktop/orca/src/preload/index.ts",
    "apps/desktop/orca/src/preload/api-types.ts",
    "apps/desktop/orca/src/renderer/src/components/coop-learning-review/**",
    "apps/desktop/orca/src/renderer/src/App.tsx",
    "apps/desktop/orca/src/shared/coop-learning-review.ts",
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

## Review (attempt 1)

- Reviewer: claude-sonnet-5
- Date: 2026-08-04
- Result SHA reviewed: `f36ad38bba077f360228cc0558e6b3bc945963c7`
- Decision: `rework`
- Findings:
  - BLOCKER — `apps/desktop/orca/src/renderer/src/components/coop-learning-review/CoopLearningReviewScreen.tsx` + `App.tsx` — The screen has no way to be opened by a human in the shipped app. It renders `null` unless a `window` `coop-learning-review:open` event fires (`COOP_LEARNING_REVIEW_OPEN_EVENT`), and nothing in the entire diff or pre-existing codebase dispatches that event — no menu item, command-palette entry, sidebar button, or keyboard shortcut. `grep -rn "COOP_LEARNING_REVIEW_OPEN_EVENT" apps/desktop/orca/src` (excluding the test file) only shows the constant's definition and its own `addEventListener`; the only place the event is ever dispatched is `CoopLearningReviewScreen.test.tsx`, which fires it manually. The comparable `OpenCodeSessionsScreen` referenced as this task's IPC/preload/renderer convention doesn't use this window-event pattern either, so there was no existing wiring to reuse and none was added. Impact: the entire feature — listing candidates, replaying citations, marking verdicts — is unreachable through the real app; a human cannot perform the task's stated Outcome at all today. — criterion: Acceptance 1-4 (the screen must actually be usable) and the task's Outcome.
  - MAJOR — Acceptance criterion 5 (hands-on evidence) — no artifact anywhere (task doc, gate JSON, commit) records replaying at least three real citations from the real `DEVX-023`/`DEVX-025` candidates and confirming the rendered source matches. I independently reproduced the pipeline myself: ran `tools/corpus-learning/extract-candidates.mjs` against the real `C:\Dev2026\Docs\tasks` corpus, then called the shipped `parseExtractorCandidates`/`replayCitation` against the real output — the mechanism does genuinely work (e.g. resolved `008-02.md`'s `### Parecer do Agente Revisor (Reviewer):` section and rendered real surrounding lines with a real line-numbered match) — but the worker never captured or recorded this evidence as the criterion requires, and the shipped default report parser (`parseReportCandidates`) always sets `citation: null`, so the DEVX-025 report path can never be replayed at all, narrowing real replay evidence to extractor-origin candidates only, undocumented either way. — criterion: Acceptance 5.
  - MAJOR — Scope — two files outside the declared `scope.allow` with no documented disposition: `apps/desktop/orca/src/main/ipc/register-core-handlers.ts` (registers the new IPC handlers; 2 lines) and `apps/desktop/orca/src/shared/coop-learning-review.ts` (the cross-layer type contract; 95 lines, new file). Both are minimal, necessary wiring/typing with no unsafe writes — I don't believe they're malicious or risky — but `scope.allow` should have listed them and the task doc records no justification for touching files outside it. Classifying MAJOR rather than BLOCKER because neither file writes to any forbidden target and both are functionally required for the feature to compile/register at all. — criterion: scope compliance (not tied to a numbered acceptance criterion).
  - MINOR — `apps/desktop/orca/src/main/ipc/coop-learning-review.ts` `verdictsFilePathFor`/`saveVerdicts`/`loadVerdicts` build the verdicts path via `join(evidenceDir, \`${source}-candidate-verdicts.json\`)` without validating `source` for traversal segments, unlike `replayCitation`'s citation file handling (`hasTraversalSegment`). A crafted `source` (from `coopLearningReview:load`/`setVerdict` IPC args) containing `../` could write outside `docs/planning/evidence/`. In every case the filename keeps the fixed `-candidate-verdicts.json` suffix, so it structurally can never become `PITFALLS.md`, `docs/coop/tool-usage-pitfalls.md`, or a skill file — the task's core non-goal holds regardless — but the traversal check should be applied here too for defense in depth.
  - MINOR/INFO — `replayCitation` only rejects traversal segments (`..`) in *relative* citation paths; `isAbsolute(citation.file)` bypasses that check entirely, so an absolute path in a candidate's citation is opened with no boundary check. Read-only, and today's candidate sources are locally generated/trusted, but it's a broader file-read surface than the Non-goals' "this project's own markdown task corpus" implies.
  - INFO — `docs/planning/evidence/DEVX-043-gate.json`'s recorded `stdout` for the `validate-gate-artifact.mjs` gate is `"OK: valid gate artifact"`, but re-running that exact command against this artifact prints `VALID` — the literal text doesn't match what the tool actually outputs, though the exit code and pass/fail semantics are correct and the resultSha binding itself checks out independently (walked back from HEAD `f36ad38bb`, which touches only `DEVX-043-gate.json`, to `6522cd91f`, which matches the artifact's declared `resultSha`).

## Scope correction (attempt 2)

The rework adds two files to `scope.allow` that attempt 1 touched without a
documented disposition (reviewer MAJOR finding):

- `apps/desktop/orca/src/main/ipc/register-core-handlers.ts` — the 2-line
  registration site that mounts `registerCoopLearningReviewHandlers()`; the
  feature cannot load without it.
- `apps/desktop/orca/src/shared/coop-learning-review.ts` — the cross-layer
  type contract shared by main/preload/renderer; the feature cannot compile
  without it.

Both are minimal wiring/typing with no unsafe writes, matching how DEVX-044
documented its own scope correction. The reviewer classified them MAJOR-not-
BLOCKER precisely because neither writes to any forbidden target.

## Review (attempt 2)

- Reviewer: claude-sonnet-5
- Date: 2026-08-05
- Result SHA reviewed: `1f783be8ded4589dcc3d014b1503b7dbd4916174`
- Decision: `rework`
- Findings:
  - BLOCKER — `apps/desktop/orca/src/main/ipc/coop-learning-review.ts:459` — `loadCandidates()`'s report branch calls `path.relative(rootDir, reportPath)`, but the file only imports named members from `node:path` (`basename, dirname, isAbsolute, join, resolve`) — there is no `path` in scope. I registered the real IPC handlers and invoked the actual `coopLearningReview:load` handler with `rootDir` set to this repo (where `docs/planning/evidence/DEVX-025-tool-usage-report.md` exists at its default location, exactly as it does today): it throws `ReferenceError: path is not defined` at `coop-learning-review.ts:459`, propagating out of `loadResultFromArgs` and the `ipcMain.handle('coopLearningReview:load', …)` callback with no try/catch anywhere in the chain. Independently confirmed via `tsc --noEmit -p config/tsconfig.node.json`: `src/main/ipc/coop-learning-review.ts(459,11): error TS2304: Cannot find name 'path'` — a new error, not one of the two pre-existing unrelated `tsc` errors the gate artifact itself acknowledges (`OpenCodeSessionsScreen.tsx` TS2307, `opencode-sdk-types.ts` TS2614). The renderer calls `window.api.coopLearningReview.load()` with no arguments (`CoopLearningReviewScreen.tsx:64`), which resolves `rootDir` via `discoverRepoRoot()` to this same repo root, so this is the exact call a human makes by clicking the new titlebar button today. Because `loadCandidates` is one function that pushes extractor-origin candidates first and then throws while building the report-origin ones, the whole IPC call fails and the screen gets zero candidates — including the extractor-origin ones that worked fine in attempt 1. No test in the suite catches this: the 21 `coop-learning-review.test.ts` tests never invoke the registered `coopLearningReview:load` handler (only assert it's registered by name at line 362), and the 5 `CoopLearningReviewScreen.test.tsx` tests fully mock `window.api.coopLearningReview`, so the real main-process code path is never exercised end-to-end by CI. This is the exact code this rework added to satisfy attempt 1's MAJOR finding ("`parseReportCandidates` always set `citation: null`") — the fix is correct in isolation (verified via direct `parseReportCandidates`/`resolveCitationInText` calls and unit tests) but the wiring that plugs it into the real IPC path is broken, so the feature remains functionally unusable end-to-end in this very repository today, just via a different failure mode than attempt 1's. — criterion: Acceptance 1 (screen lists candidates) and 2 (citation replay), and the task's Outcome (a human must actually be able to open and use the screen).
  - MAJOR — Acceptance criterion 5 (hands-on evidence) — the gate artifact's replay evidence for the report-origin candidate almost certainly called `parseReportCandidates` directly with an explicit `reportPath` argument (as the new unit test does), the same blind spot I had on my first pass, bypassing `loadCandidates`'s buggy call site entirely. The evidence technically satisfies replaying citations against real content, but it never exercised the real `coopLearningReview:load` IPC path where the actual defect lives, so it did not — and could not — catch the regression above. Required for the next attempt: capture criterion-5 evidence by calling the actual registered IPC handler (or the renderer flow end-to-end), not just the pure parser/replay functions in isolation.
  - INFO — Confirmed good: the titlebar trigger (`App.tsx` `BookOpen` button dispatching `COOP_LEARNING_REVIEW_OPEN_EVENT`, mirroring the adjacent `sidebar-toggle` "Toggle sidebar" Tooltip button) is genuinely wired end-to-end — `CoopLearningReviewScreen` is unconditionally mounted in the overlay stack (`App.tsx:2649`, alongside `OpenCodeSessionsScreen`) and listens for the same event constant the button now exports and dispatches. This closes attempt 1's reachability BLOCKER as far as the UI trigger goes; only the data-loading bug above still blocks real use.
  - INFO — Confirmed good: `scope.allow` now lists `register-core-handlers.ts` and `shared/coop-learning-review.ts` with a documented justification (`## Scope correction (attempt 2)`); `git diff --stat` from base to result SHA shows only files inside the corrected `scope.allow` (plus the task's own spec file, standard self-documentation) were touched.
  - INFO — Confirmed good (fix-if-trivial, not required): `verdictsFilePathFor`/`saveVerdicts`/`loadVerdicts`/`setVerdict` now reject `source` values containing traversal segments the same way `replayCitation` already did for citation files, with new passing tests (`refuses to load/save verdicts for a traversal source`, `rejects a traversal source in setVerdict`).
  - INFO — Re-ran the declared gates myself: `node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-043.md` → `OK: DEVX-043 (ready, standard, 5 criteria)`; `node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-043-gate.json --result-sha=1f783be8ded4589dcc3d014b1503b7dbd4916174` → `VALID`; `tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-learning-review.test.ts` → 21/21 pass (matches gate artifact). Also ran the renderer suite (`CoopLearningReviewScreen.test.tsx`, 5/5 pass) and reproduced >=10 real citation replays against the real `C:\Dev2026\Docs\tasks` corpus via `parseExtractorCandidates`/`replayCitation` called directly (not through the buggy `loadCandidates` path) — the underlying replay mechanism itself is genuinely sound; only the report-branch wiring inside `loadCandidates` is broken. Walked HEAD (`3ae6e76a6`, touches only `DEVX-043-gate.json`) back to `1f783be8d`, matching the gate artifact's declared `resultSha` — the gate-evidence binding is valid.

## Review (attempt 3)

- Reviewer: claude-sonnet-5 (coop-reviewer, cold/independent)
- Date: 2026-08-05
- Result SHA reviewed: `295b72ed9656f2157d0a1372db36b51c78934090`
- Decision: `accept`
- Findings:
  - INFO — `apps/desktop/orca/src/main/ipc/coop-learning-review.ts` — Confirmed the attempt-2 BLOCKER is fixed correctly: the import at the top of the file now reads `import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'` (added `relative` to the existing named-import list, matching the file's own import style, not a `path` namespace import), and the call site at the former line 459 now reads `relative(rootDir, reportPath)` instead of `path.relative(rootDir, reportPath)`. Traced the name `relative` into scope directly from this import — no `path` namespace reference remains anywhere in the report branch.
  - INFO — Independently reproduced the fix myself, not just read it. Wrote a throwaway vitest file (`zz-repro-devx043.test.ts`, deleted after use, never committed) that mocks only `electron`'s `ipcMain.handle` (the same minimal mock the shipped test suite uses) and calls `registerCoopLearningReviewHandlers()`, then invokes the captured real `coopLearningReview:load` handler with **no args** — i.e. `rootDir` resolves via the real `discoverRepoRoot()` against this actual repo, the exact call `window.api.coopLearningReview.load()` makes from the renderer with zero synthetic fixtures. Result: `ok:true`, no error, 6 report-origin candidates returned (matches the gate artifact's claimed count) — previously this threw `ReferenceError: path is not defined` under attempt 2's code. I then invoked the real registered `coopLearningReview:replay` handler for 3 of those real citations and got `ok:true` with real `contextLines` for each; spot-checked all three against the actual file content at `docs/planning/evidence/DEVX-025-tool-usage-report.md` lines 233-236, 251-256, and 266-271 — the rendered section headings and surrounding text (e.g. "478 de 840 falhas de edit (56.9%)", "216/840 (25.7%)", "78/840 (9.3%)") match the real file exactly. This independently satisfies Acceptance criterion 5 through the real IPC-registered handlers, not the pure parser functions.
  - INFO — Confirmed the new test the worker added (`load handler returns report-origin candidates when a report is present at the default path`, `coop-learning-review.test.ts`) genuinely exercises the registered `coopLearningReview:load` handler (found via `handleMock.mock.calls.find(call => call[0] === 'coopLearningReview:load')`), not just `parseReportCandidates` in isolation, with a real temp-directory report file placed at the correct default-relative structure (`docs/planning/evidence/DEVX-025-tool-usage-report.md` under a temp `rootDir`) — matching `DEFAULT_DEVX025_REPORT_REL`'s actual value read from source. Confirmed this test would have failed under attempt 2's code: `registerCoopLearningReviewHandlers()` registers `coopLearningReview:load` as a **synchronous** callback (`(_event, args) => loadResultFromArgs(args ?? {})`, not `async`), so the `ReferenceError` thrown inside `loadCandidates`'s report branch propagates as a synchronous throw at the `await loadHandler(...)` call site in the test body, with no surrounding try/catch — this is a real regression test, not one that would pass either way.
  - INFO — Ran the full declared test file myself: `tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-learning-review.test.ts` from `apps/desktop/orca` → `Test Files 1 passed (1)`, `Tests 22 passed (22)`, matching the gate artifact exactly.
  - INFO — Ran `tsc --noEmit -p config/tsconfig.node.json` myself. `coop-learning-review.ts` and `coop-learning-review.test.ts` produce zero errors — the attempt-2 `TS2304: Cannot find name 'path'` at line 459 is gone. The full `tsc` run does show a longer list of pre-existing errors in unrelated files (`ai-vault/session-scanner-crush-cleanup.test.ts`, `ai-vault/session-scanner-opencode-sources.test.ts`, `evidence/session.ts`, `native-chat/transcript-watch.ts`, `preload/index.ts` unused `OpenCodeSdkListSessionsResult` import, `shared/opencode-sdk-types.ts` TS2614) than the two the gate artifact's `regressions` field names — verified none of those files were touched by DEVX-043 at any attempt (`git diff --stat` from base to this result SHA touches only files inside `scope.allow`; `preload/index.ts`'s 7 added lines are nowhere near its unused import), so this is pre-existing baseline noise unrelated to and not introduced by this task, not a DEVX-043 regression. Worth a follow-up ticket to correct the gate artifact's baseline description, but it doesn't change this task's verdict.
  - INFO — Re-ran `node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-043-gate.json --result-sha=295b72ed9656f2157d0a1372db36b51c78934090` → `VALID`. Walked HEAD (`eae25ca11`, touches only `docs/planning/evidence/DEVX-043-gate.json`) back to `295b72ed9`, matching the gate artifact's declared `resultSha` — the gate-evidence binding is valid.
  - INFO — Confirmed scope discipline: `git diff --stat` from `1f783be8d` (attempt 2 result) to `295b72ed9` (attempt 3 result) touches exactly 4 files — `coop-learning-review.ts` (single-line import + call-site fix), `coop-learning-review.test.ts` (new test), `docs/coop/tasks/DEVX-043.md` (self-documentation), and `docs/planning/evidence/DEVX-043-gate.json`. `git diff --stat` from base to `295b72ed9` touches only files inside the corrected `scope.allow` plus the task's own spec file. The attempt-2 fixes remain untouched and intact: the titlebar `BookOpen` button in `App.tsx` still dispatches `COOP_LEARNING_REVIEW_OPEN_EVENT`; `hasTraversalSegment` is still enforced for both citation replay and verdict-file paths.
  - No BLOCKER, MAJOR, or MINOR findings. The rework is minimal, correctly targeted, independently reproduced against the real IPC path (not just re-trusted from the gate artifact or the worker's own test), and does not regress any of the fixes confirmed good in attempt 2.
