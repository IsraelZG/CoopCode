---
{
  "id": "DEVX-041",
  "title": "Show a task's hands-on evidence files inline on the board instead of leaving them as unlinked prose claims",
  "state": "ready",
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
