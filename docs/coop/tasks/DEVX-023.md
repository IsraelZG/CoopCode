---
{
  "id": "DEVX-023",
  "title": "Extract verifiable learnings from the superapp corpus: deterministic filter plus semantic analysis, every rule traceable to its source",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/corpus-learning/**",
    "docs/planning/evidence/DEVX-023-corpus-inventory.md",
    "docs/planning/evidence/DEVX-023-sample-audit.md",
    "docs/planning/evidence/DEVX-023-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 240, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-023.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-023-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/corpus-learning/test-extract-candidates.mjs",
      "purpose": "Self-check of the deterministic filter, same pattern as test-select-task.mjs"
    }
  ]
}
---

# DEVX-023 · Turn the superapp corpus into traceable, checkable learnings

## Outcome

The deterministic half of a learning pipeline exists and is proven on real
data: it reads the superapp task corpus and its Crush session history, emits
compact per-candidate payloads a language model can analyse without drowning,
and every payload carries the exact citation (file, section, finding marker)
that a human or a `grep` can verify. A sampled batch is audited by hand
against the sources before any rule is proposed for `PITFALLS.md`.

This task deliberately stops short of writing to `PITFALLS.md` or any skill.
It produces candidates and proves they are real; adopting them is a separate,
human decision.

## Acceptance

- [ ] `tools/corpus-learning/extract-candidates.mjs` reads the corpus
      **read-only** and emits one compact JSON payload per candidate. It must
      open `C:\Dev2026\Docs\.crush\crush.db.bak` with SQLite's read-only mode
      and must never write to, rotate, or WAL-recover any file under
      `C:\Dev2026\Docs\` — that 757 MB file is the only copy of the history
      and a `-wal` sibling exists next to it. Verify the file's size and mtime
      are unchanged after a full run and record both in the report.
- [ ] Each payload contains: the task id, the task's §1 Objetivo (what was
      asked), the finding text with its `[M*]`/`[B*]` marker, the `### Rework`
      round if any, the relevant §6 Feedback de Especificação entry when
      present, and a `citation` field giving file path plus section heading
      precise enough that a reviewer can `grep` it and land on the same text.
      A candidate that cannot produce a verifiable citation is dropped, not
      guessed.
- [ ] The join between Crush sessions and tasks is done on the `T-NNN` id
      found in session titles — verified 2026-08-01 as the real scheme (344
      task files use it; the `NNN-NN` filename pattern matched only 2 of 725
      session titles and is the wrong key). Report the join hit rate: how
      many of the 725 sessions bind to a task, and how many candidates come
      from tasks with no session at all (task-only candidates are still
      valid; the session is enrichment, not a requirement).
- [ ] `docs/planning/evidence/DEVX-023-corpus-inventory.md` records the real
      shape of the corpus as measured by the script, not as assumed: counts
      per finding-marker letter, how many tasks carry §6/§8/`### Rework`,
      how many candidates were emitted, and how many were dropped for lack
      of a citation, with the drop reasons grouped.
- [ ] `docs/planning/evidence/DEVX-023-sample-audit.md` takes a random sample
      of at least 20 emitted candidates and, for each, quotes the source text
      the citation points at and states whether the payload faithfully
      represents it. Any mismatch is a defect in the extractor and must be
      fixed before this task closes — this is the criterion that keeps the
      pipeline from manufacturing plausible-sounding fiction.

## Non-goals

- Do not write to `PITFALLS.md`, any file under `C:\Dev2026\Docs\`, or any
  skill in `.claude/skills/`. This task only reads that corpus and writes its
  own outputs under `agentic-ide`. Adopting a rule is a human decision and a
  later task.
- Do not build the automated dispatch loop. That is `DEVX-024`, which
  consumes this task's chunking.
- Do not call a language model from `extract-candidates.mjs`. The script is
  the deterministic filter; the semantic step runs as an agent reading the
  payloads. Keeping the boundary sharp is what makes the filter testable
  offline and cheap to re-run.
- Do not attempt to analyse all 115,170 messages. Session messages are
  enrichment for candidates the task corpus already identifies — pulling a
  bounded, cited excerpt around the relevant exchange is in scope; walking
  the whole message table is not.
- Do not modify or "clean up" the superapp tasks themselves.

## Sources and decisions

- Measured directly 2026-08-01, read-only, not assumed:
  `C:\Dev2026\Docs\.crush\crush.db.bak` (757 MB) holds 725 sessions, 115,170
  messages, 12,548 files; the live `crush.db` holds only 9 sessions / 879
  messages, so the `.bak` is the corpus of record. Both share the schema
  `sessions(id, parent_session_id, title, message_count, prompt_tokens,
  completion_tokens, cost, updated_at, created_at, summary_message_id,
  todos)` and `messages(id, session_id, role, parts, model, created_at, ...)`
  with `parts` a JSON array of `{type, data}`.
- `C:\Dev2026\Docs\tasks\` holds 594 task files: 344 named `T-NNN*.md`, plus
  `EST-*` (78), `C-*` (36), `DMM-*` (17), `ORQ-*` (15) and 15 `NNN-NN`.
  Status distribution is 352 `done`, 95 `draft:triaged`, 60 `ready`, 39
  `obsolete`, and exactly **1** `rework` — which is why `status` is the wrong
  filter for "this task had a problem": it records the final state, so a task
  that was reworked and then approved reads `done`.
- The real signal lives in the task body: `## 8. Log de Handover e Revisão
  Agile (Code Review)` (509 tasks) contains `### Rework (date — model)`
  subsections (34 tasks, 42 rounds) with structured findings marked
  `**[M1]**`, `**[B1]**` etc. Corpus-wide there are **1010 `[M*]`** and
  **569 `[B*]`** markers — far more learning material than the 34
  formally-reworked tasks alone.
- `## 6. Feedback de Especificação (Spec Feedback Loop)` (545 tasks) already
  contains human/agent root-cause analysis of spec ambiguity, written at the
  time ("DECISÃO #N RESOLVIDA — ... Por que não: ..."). Treat it as
  pre-digested evidence to cite and cluster, not as something to re-derive.
- `C:\Dev2026\Docs\PITFALLS.md` — 25 entries, latest `P-023`, fixed format:
  `## P-NNN · Título`, then `**Data:**`, `**Sintoma:**`, `**Causa raiz:**`,
  `**Solução aplicada:**`, `**Evidência:**`, `**Como prevenir recorrência:**`,
  `**Limites:**`. Candidate rules must be shaped to this format so adoption
  is a copy, not a rewrite. `C:\Dev2026\Docs` is a git repo, so any future
  adoption is reviewable as a diff.
- `tools/coop-dev/test-select-task.mjs` — the `test-<name>.mjs` self-check
  convention the new test file follows.

## Plan and test mapping

1. Write `extract-candidates.mjs` reading the corpus read-only; confirm the
   `.bak` size and mtime are unchanged after a full run. Criterion 1.
2. Build the payload shape with mandatory citations; drop uncitable
   candidates. Criterion 2.
3. Implement and measure the `T-NNN` session↔task join; report hit rate.
   Criterion 3.
4. Write the inventory from the script's own measurements. Criterion 4.
5. Sample 20+ candidates, audit each against its cited source by hand, fix
   any extractor defect found. Criterion 5.
6. Write `test-extract-candidates.mjs` against small fixtures (not the real
   757 MB file). Run the declared gates and write
   `docs/planning/evidence/DEVX-023-gate.json`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. Closing
this task means the candidates are real and traceable — not that any rule has
been adopted. `DEVX-024` consumes the chunking; adoption into `PITFALLS.md`
or the skills is a separate human decision on reviewed candidates.
