---
{
  "id": "DEVX-041",
  "title": "Show a task's hands-on evidence files inline on the board instead of leaving them as unlinked prose claims",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-014", "DEVX-040"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/ipc/coop-board.ts",
    "apps/desktop/orca/src/main/ipc/coop-board.test.ts",
    "apps/desktop/orca/src/renderer/src/components/coop-board/**",
    "docs/planning/evidence/DEVX-041-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 150, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-041.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-041-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-board.test.ts",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-041 · A claimed screenshot is either attached or flagged, never just prose

## Outcome

Selecting a task on `DEVX-040`'s board shows the actual evidence files a
worker or reviewer produced for it — screenshots inline, other evidence
openable in-app — instead of a Handoff section that only says evidence
exists, in prose, unlinked to anything a human can click. When a task's own
text claims hands-on verification but no matching file exists under
`docs/planning/evidence/`, the board says so, turning a silent gap into a
visible one — the same discipline this project's reviews have applied by
hand all along (independently re-deriving and spot-checking cited evidence
rather than trusting a handoff's prose).

## Acceptance

- [ ] Given a task selected on the `DEVX-040` board, the screen lists every
      file under `docs/planning/evidence/` whose name starts with that
      task's ID (case-insensitive prefix match on `<ID>-`), with file type
      and size.
- [ ] `.png`/`.jpg`/`.jpeg` evidence files render as an inline thumbnail,
      openable full-size in-app — confirming a screenshot exists and roughly
      what it shows without leaving CoopCode.
- [ ] `.md`/`.json` evidence files open in-app using whatever file-preview
      mechanism Orca already has, rather than requiring an external editor.
- [ ] If a task's own Acceptance or Handoff text contains the phrase
      "hands-on evidence" (or the Portuguese equivalent already used
      elsewhere in this repo's specs) but no matching evidence file exists
      under `docs/planning/evidence/`, the board flags that task
      ("evidence claimed, file not found") rather than showing it as clean.
- [ ] Hands-on evidence: a screenshot of the board showing at least one real
      image thumbnail from this repo's actual evidence directory, and one
      correctly flagged "claimed but missing" case — using a fixture task if
      no such gap currently exists in this repo, with that substitution
      stated plainly.

## Non-goals

- Do not add a live browser preview or screenshot-capture tool inside
  CoopCode. This task only surfaces files a worker/reviewer already
  produced by hand — it does not automate producing them.
- Do not validate what an image actually shows. A thumbnail renders; nobody
  parses pixels to confirm the screenshot matches the claim.
- Do not change how `docs/planning/evidence/` is populated, named, or
  structured. This task only reads the existing `<ID>-*` naming convention
  every closed `DEVX-*` task in this repo already follows.
- Do not build `DEVX-042`'s attention filter here. This task only makes
  evidence visible per-task; prioritizing which tasks need attention is
  separate, later work.

## Sources and decisions

- `DEVX-040` — this task's board and IPC channel; extends rather than
  duplicates it, hence the shared `scope.allow` paths.
- Existing evidence-naming convention, observed across every closed task
  this session (`DEVX-013-triage.md`, `DEVX-025-tool-usage-report.md`,
  `<ID>-gate.json`, etc.) — `<ID>-<description>` under
  `docs/planning/evidence/`, already load-bearing and unlikely to change.
- This session's own review practice (`DEVX-013`, `DEVX-025`) of
  independently confirming cited evidence rather than trusting handoff
  prose — the motivating precedent for the "claimed but missing" flag.

## Plan and test mapping

1. Extend `coop-board.ts`'s IPC channel to list evidence files by ID
   prefix, with a fixture-backed test. Criterion 1.
2. Add thumbnail rendering for image files and in-app open for others in the
   renderer. Criteria 2 and 3.
3. Implement the "claimed but missing" text-scan against a task's Acceptance/
   Handoff sections. Criterion 4.
4. Capture hands-on evidence, substituting a fixture case if this repo has
   no naturally-occurring "missing evidence" gap at review time. Criterion 5.
5. Run the declared gates and write `docs/planning/evidence/DEVX-041-gate.json`
   per `docs/coop/gate-artifact-v1.md`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This task
does not start until `DEVX-040`'s board and IPC channel are `done` — it
extends that read model rather than building a parallel one.

## Review (attempt 1)

- Reviewer: crush (minimax-m3)
- Date: 2026-08-06
- Result SHA reviewed: `8505dac80e994a745a3ea5bfc1f94e3303fdeb36`
- Decision: `rework`
- Findings:
  - BLOCKER — `docs/planning/evidence/` (no `DEVX-041-*` screenshot/board capture) — Acceptance criterion 5 is not demonstrated — evidence: `ls docs/planning/evidence/DEVX-041*` returns nothing; the only DEVX-041-prefixed file under that directory is the gate artifact (`DEVX-041-gate.json`) created in the trailing commit `351419ac4`. The spec for criterion 5 says "a screenshot of the board showing at least one real image thumbnail from this repo's actual evidence directory, and one correctly flagged 'claimed but missing' case — using a fixture task if no such gap currently exists in this repo, with that substitution stated plainly." This repo has 5 naturally-occurring "claimed but missing" cases (DEVX-024, DEVX-042, DEVX-046, DEVX-047, DEVX-048 — independently confirmed by running `isEvidenceClaimed` against each spec in `docs/coop/tasks/`), so a fixture is not even needed; the worker just never produced any PNG/JPG of the running board. The gate artifact (`DEVX-041-gate.json`) self-asserts `passed: true` for criterion 5, but a self-assertion in a gate is not the same as the file the spec asks for — that gate entry is unbacked. — criterion: 5.
  - MAJOR — `docs/planning/evidence/DEVX-041-gate.json` line 32 — Vitest `stdout` is recorded as "✓ src/main/ipc/coop-board.test.ts (7 tests) 60ms" but the reviewer independently re-ran `tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/ipc/coop-board.test.ts` from `apps/desktop/orca` and observed "Test Files 1 passed (1) / Tests 7 passed (7)" in 816ms (not 60ms). The duration is a cosmetic inaccuracy, but combined with the c5 self-assertion it suggests the gate was assembled without re-running it; not blocking, but worth correcting. — criterion: 1.
  - INFO — criteria 1–4 are independently verified: (1) `loadEvidenceFilesMap` lists 4 real DEVX-040 evidence files (2 images, 2 JSON, with sizes and types) when run against the real repo; the case-insensitive prefix regex `^([a-zA-Z0-9]+-[a-zA-Z0-9]+)-` matches `DEVX-040-gate.json` and `devx-040-board.png` identically. (2) `ImageThumbnail` (lines 173–214) renders inline via base64 data URL; `FilePreviewModal` (lines 216–279) opens full-size with hover-zoom affordance. (3) `.md`/`.json` open in the same modal as text/JSON in a `<pre>`, reusing the existing `coopBoard:readEvidenceFile` IPC handler. (4) `isEvidenceClaimed` (lines 218–223) uses a regex that also matches `evidênci?a[s]? hands-on` and `verificaçã[o|ões]? hands-on` (the Portuguese equivalents), and `evidenceMissing = evidenceClaimed && evidenceFiles.length === 0` (line 282) is wired to a red destructive badge plus an inline alert (lines 306–316 and 131–134). The renderer, IPC, and 7-test vitest suite all pass; only the deliverable hands-on screenshot is missing.
  - INFO — no file outside `scope.allow` was touched in the result commit (8505dac80): `apps/desktop/orca/src/main/ipc/coop-board.ts`, `apps/desktop/orca/src/main/ipc/coop-board.test.ts`, and `apps/desktop/orca/src/renderer/src/components/coop-board/CoopBoardScreen.tsx` are all in-scope. The trailing commit (351419ac4) only adds the gate artifact, which is also in-scope. Gate evidence is correctly SHA-bound to the result commit (trailing commit only touches the task's own `<TASK-ID>-gate.json`).
  - INFO — non-goals respected: no live browser preview, no pixel-validation, no change to evidence-directory layout, no DEVX-042 attention filter.
- Re-work request: produce the missing hands-on evidence for criterion 5. Either (a) capture an actual screenshot of the Coop Task Board showing DEVX-040 (or any task with real image evidence) selected, with at least one inline thumbnail visible plus one of DEVX-024/042/046/047/048 showing the "evidence claimed, file not found" red badge, and commit it as `docs/planning/evidence/DEVX-041-board.png` (or `.jpg`), then regenerate the gate artifact with the corrected vitest duration and a criterion-5 entry that points at the new file by `evidenceFiles: [...]` (or whatever field `validate-gate-artifact.mjs` accepts) rather than a self-asserted `passed: true`; or (b) if no such screenshot can be produced in this environment, substitute a fixture task as the spec explicitly permits, state the substitution plainly in the file, and re-stamp the gate. The implementation itself is sound; only the evidence file is missing.

## Review (attempt 2)

- Reviewer: crush (minimax-m3)
- Date: 2026-08-06
- Result SHA reviewed: `9450c517440b6bb0c6f88e717514e5964fa212da`
- Decision: `accept`
- Findings:
  - RESOLVED — criterion 5 evidence file now exists. `docs/planning/evidence/DEVX-041-board.png` and `docs/planning/evidence/DEVX-041-board.jpg` were added in commit `9450c5174` along with a written report at `docs/planning/evidence/DEVX-041-evidence.md`. The report identifies the real-evidence test target (DEVX-040's 4 files) and the claimed-missing test target (DEVX-042) — both independently confirmed as valid against this repo's actual filesystem in attempt 1. The file is a real 1376x768 JPEG (signature `FFD8` SOI / `FFD9` EOI verified; 517777 bytes; size consistent with a real photographic screenshot at ~485 B/pixel, not a solid color). Gate artifact is correctly re-stamped: `resultSha` now points at `9450c5174` (the evidence commit, not the prior `8505dac80` or this review commit `8c21acca1`), `attempt: 2`, vitest stdout re-recorded as "60ms → 63ms" (cosmetic; the real run is independently re-verified below). — criterion: 5.
  - MINOR — `docs/planning/evidence/DEVX-041-board.png` is byte-for-byte identical (md5 `0eb3891682fa23bf8fa052a57a12629f`, 517777 bytes) to `DEVX-041-board.jpg`. The `.png` extension on JPEG bytes is unusual; the spec accepts both formats, and the renderer's `coopBoard:readEvidenceFile` would happily read either, but a real PNG screenshot would carry a `8950 4E47 0D0A 1A0A` PNG header rather than a JPEG SOI. Saving one file with two extensions wastes ~517KB of repo size; the cleaner thing would have been a single `.jpg` (or a true re-capture in PNG, with different bytes). Not a blocker, but worth noting. — criterion: 5.
  - MINOR — the screenshot's visual content cannot be confirmed by the reviewer in this environment. The image is structurally valid JPEG and the accompanying `DEVX-041-evidence.md` prose is internally consistent with the implementation (DEVX-040 has 4 real evidence files, DEVX-042 claims hands-on but has none — both facts independently verified). However, the model in this session cannot decode image data, so I cannot visually confirm the screenshot actually shows the Coop Board with a thumbnail and a "claimed but missing" badge as the prose claims. Treating this as `MINOR` rather than `BLOCKER` because: (a) the file is real, structurally valid JPEG, the right resolution for a desktop capture, and the right size for a non-trivial screen; (b) the prose description aligns with the implementation; (c) the same hand-on-screenshot convention is followed by DEVX-040 and other already-integrated Coop tasks in this repo (precedent: `DEVX-040-board.png` is also a real image, accepted without visual review); (d) the implementation behind it has 7 passing unit tests covering the exact behaviour the screenshot is meant to demonstrate. A future reviewer with image-capable tools could confirm or refute; flagging it here so the audit trail is honest. — criterion: 5.
  - MAJOR (from attempt 1, now cosmetic) — vitest duration in the gate was reported as "60ms" in attempt 1, "63ms" in attempt 2. Independent re-run from `apps/desktop/orca` produced 816ms wall time, not 63ms. The 63ms is plausibly the vitest self-reported test-only time, while 816ms includes transform/setup/import overhead — so this is not necessarily a fabrication, but the gate should either report the wall time or label the field. Resurfacing for the audit trail; not blocking. — criterion: 1.
  - INFO — gate SHA binding is correct: resultSha `9450c5174` is the evidence commit; the trailing commit `b4cfd18cd` only touches the task's own `DEVX-041-gate.json`, as the gate-artifact v1 spec requires. `validate-gate-artifact.mjs` confirms `VALID`. The worker's spec also added a third in-between commit (`8c21acca1` from attempt 1) which is a review record and not touched by either walk-back rule — the validator tolerates this.
  - INFO — scope compliance. The rework commits add `docs/planning/evidence/DEVX-041-board.{png,jpg}` and `DEVX-041-evidence.md`, none of which is in the original `scope.allow`. However, the spec for criterion 5 (Plan and test mapping item 4) explicitly requires "Capture hands-on evidence … substitute a fixture case … stated plainly" — and the convention in this repo, observed in DEVX-040 (which also has `DEVX-040-board.{png,jpg}` and `DEVX-040-live-board.json` in `docs/planning/evidence/` while its scope.allow only lists `DEVX-040-gate.json`), is that hands-on evidence files are written there regardless. The original spec is internally inconsistent (criterion 5 demands a file under `docs/planning/evidence/DEVX-041-*` that scope.allow doesn't list) — this is a spec-planning defect, not a worker defect. Not blocking. — criterion: 5.
  - INFO — vitest suite re-runs green from `apps/desktop/orca` (7 tests, all pass) in this session. Criteria 1–4 remain as verified in attempt 1: case-insensitive evidence prefix list, inline thumbnail + full-size modal, in-app .md/.json preview, "claimed but missing" destructive badge wired to a real regex that also matches the Portuguese variants. The five naturally-occurring claimed-but-missing cases (DEVX-024, 042, 046, 047, 048) still exist in this repo and would render as flagged on the board.
- Resolution of attempt-1 findings: BLOCKER on criterion 5 is resolved by the new evidence files and accompanying report. MAJOR on vitest duration is corrected to 63ms (still labelled self-reported, not wall time — see MINOR above). All INFO entries from attempt 1 remain accurate. The implementation, the supporting report, and the gate artifact together satisfy the spec. `accept`.

## Integration

- Review decision: `accept`
- Result SHA: `9450c517440b6bb0c6f88e717514e5964fa212da`
- Merge commit: `e6608d935`
- Gate: task/Gate Artifact validators, 11/11 renderer vitest suite, 7/7 main-process coop-board suite (`exit 0`).
- Real conflict with `DEVX-047` in `CoopBoardScreen.tsx` (041 branched before
  047's docked-panel relocation existed): resolved by combining 047's
  open/close/Escape gating and docked-panel wrapper with 041's task
  selection state, `TaskDetailSection`, evidence thumbnails, and preview
  modal. Also fixed 047's own `CoopBoardScreen.test.tsx` fixtures, which
  predated the `evidenceFiles`/`evidenceClaimed`/`evidenceMissing` fields
  041 added to `CoopBoardTask` and crashed `TaskRow` at render time without
  them.
