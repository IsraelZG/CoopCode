---
{
  "id": "DEVX-027",
  "title": "Internalize DEVX-025's tool-usage findings into agentic-ide itself, not the target project's PITFALLS.md",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-025"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "docs/coop/tool-usage-pitfalls.md",
    ".claude/skills/coop-worker/SKILL.md",
    "docs/planning/evidence/DEVX-027-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-027.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-027-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    }
  ]
}
---

# DEVX-027 · Findings about the tool layer belong to the tool, not to whichever project it was measured on

## Outcome

The six tool/MCP-usage findings `DEVX-025` produced (edit's stale-read-guard
failures, byte-exact match sensitivity, post-compaction re-view requirement,
`mcp_git_git_branch`'s oversized `mode: list` payload, bash-vs-dedicated-tool
routing, and `view` without `offset`/`limit`) live in `agentic-ide`, so every
project a CoopCode worker ever touches benefits from them — not only the
superapp corpus they were measured against. `C:\Dev2026\Docs\PITFALLS.md`
stays reserved for findings about that project's own code (the kind
`DEVX-023` produces), which is a different question ("what breaks in this
codebase") from this task's ("how do agents mishandle the tools themselves").

## Acceptance

- [ ] `docs/coop/tool-usage-pitfalls.md` exists, in the same fixed adoption
      format as `C:\Dev2026\Docs\PITFALLS.md` (`## P-NNN · Título`, then
      **Data:**, **Sintoma:**, **Causa raiz:**, **Solução aplicada:**,
      **Evidência:**, **Como prevenir recorrência:**, **Limites:**), with all
      six `DEVX-025` candidates adopted (own numbering, e.g. `P-001`–`P-006` —
      this is a new file/namespace, not a continuation of Docs' sequence).
      Each entry cites the source report
      (`docs/planning/evidence/DEVX-025-tool-usage-report.md`) and keeps the
      original message-id citations so a reader can still verify against the
      corpus without re-deriving anything.
- [ ] `.claude/skills/coop-worker/SKILL.md`'s "Work" section gains two
      condensed, immediately-actionable rules distilled from the cheapest
      candidates to apply: (a) re-`view` a file before retrying an `edit`
      that failed on a stale-read guard, instead of retrying blind; (b) use
      `view`'s `offset`/`limit` rather than reading a whole large file, since
      `view` without bounds is 59% of all tool-result context cost in the
      measured corpus. These are the two candidates cheapest to act on
      immediately; the other four (byte-exact matching, post-compaction
      re-view, MCP payload size, bash-vs-dedicated-tool routing) are recorded
      in the pitfalls file but not forced into the skill's prose, since they
      either need a harness change or are judgment calls, not a one-line
      habit.
- [ ] `.claude/skills/coop-worker/SKILL.md` gains a step (in "Start") telling
      the worker to read `docs/coop/tool-usage-pitfalls.md` before beginning
      work, the same relationship Docs' own skills have to its
      `PITFALLS.md` — so the file is actually applied, not merely present.
- [ ] `C:\Dev2026\Docs\PITFALLS.md` is untouched by this task. `DEVX-023`'s
      candidates (the ones tied to the superapp's own code) are a separate,
      already-identified adoption path into that file — this task does not
      do that adoption either; it only moves the tool-layer findings to
      where they generalize.

## Non-goals

- Do not adopt `DEVX-023`'s candidates anywhere. Those are superapp-specific
  (cite `sqliteStorage.ts`, `parser.ts`, `webSeedRoutes.ts`, etc.) and belong
  in `C:\Dev2026\Docs\PITFALLS.md` on a separate human decision, unrelated to
  this task's scope.
- Do not re-derive or re-verify `DEVX-025`'s numbers. They were independently
  confirmed during that task's review; this task only relocates the
  already-verified findings into a new, better-scoped home.
- Do not change `docs/coop/gate-artifact-v1.md`, `docs/coop/task-spec-v1.md`,
  or any other Coop contract document.
- Do not touch `.claude/skills/coop-dispatcher/SKILL.md` or any other skill.
  Only `coop-worker` reads/applies this file for now; extending it to other
  skills is a later decision if it proves useful.
- Do not build tooling (a linter, a pre-commit hook, an automated check) that
  enforces these rules. This task is documentation and skill guidance only.

## Sources and decisions

- `docs/planning/evidence/DEVX-025-tool-usage-report.md` — source of all six
  candidates (`P-??-DEVX-025-1` through `-6`), independently re-verified
  during `DEVX-025`'s review (exact match on every classified count, exact
  match on cited message ids, exact match on all derived percentages).
- Decided 2026-08-02: tool/MCP-usage findings generalize across every project
  CoopCode dispatches into, and therefore must live in `agentic-ide` itself
  rather than in the target project's own `PITFALLS.md` — otherwise a worker
  on any other project never benefits from them. `DEVX-023`'s findings, by
  contrast, are tied to the superapp's own code and correctly stay bound to
  that project's file. This is a smaller version of the same "where does a
  lesson learned belong" question the whole `DEVX-023`/`DEVX-025` pair
  raised, resolved by looking at what each candidate actually cites — code
  paths in one project, versus tool/harness behavior in the other.
- `C:\Dev2026\Docs\PITFALLS.md`'s fixed format (`## P-NNN · Título`, `**Data:**`,
  `**Sintoma:**`, `**Causa raiz:**`, `**Solução aplicada:**`, `**Evidência:**`,
  `**Como prevenir recorrência:**`, `**Limites:**`) — reused here for
  consistency, applied to a new file rather than that one.
- `.claude/skills/coop-worker/SKILL.md` — current structure: `Start` (lines
  10–21), `Work` (23–41), `Block instead of invent` (42–47), `Finish`
  (48–56). New content lands in `Start` (the read-first-before-work step) and
  `Work` (the two condensed rules).

## Plan and test mapping

1. Write `docs/coop/tool-usage-pitfalls.md`: adopt all six `DEVX-025`
   candidates verbatim-in-substance (same root cause, same evidence, same
   citations), reformatted into the fixed P-NNN structure. Criterion 1.
2. Add the two condensed rules to `coop-worker`'s `Work` section and the
   read-first step to `Start`. Criteria 2 and 3.
3. Diff `C:\Dev2026\Docs\PITFALLS.md` before/after to prove it is untouched.
   Criterion 4.
4. Run the declared gates and write `docs/planning/evidence/DEVX-027-gate.json`.
   This task is prose/skill-guidance, not code — per `coop-worker`'s own
   "TDD is not mandatory for prose" allowance, the observable check is the
   diff-based confirmation in step 3 plus a direct read-through of the new
   file and skill section, not a new automated test.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Success is
a file agentic-ide's own workers will actually read and apply on every future
project — not merely a second copy of `DEVX-025`'s report under a new name.
