---
{
  "id": "DEVX-025",
  "title": "Tool/MCP/LSP usage analytics from the Crush session corpus: error rates, context cost, candidate findings",
  "state": "done",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "tools/corpus-learning/extract-tool-usage-stats.mjs",
    "tools/corpus-learning/test-extract-tool-usage-stats.mjs",
    "docs/planning/evidence/DEVX-025-tool-usage-report.md",
    "docs/planning/evidence/DEVX-025-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-025.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-025-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "node tools/corpus-learning/test-extract-tool-usage-stats.mjs",
      "purpose": "Self-check of the stats extractor, same pattern as test-select-task.mjs"
    }
  ]
}
---

# DEVX-025 · What tool usage in the historical corpus reveals

## Outcome

A read-only analysis of every tool call recorded in the Crush session
history answers three concrete questions with real numbers, not
impressions: which tools return the most context back to the model
(context cost), which tools fail most often (reliability), and how MCP/LSP
usage compares to native tools in frequency and payload size. Findings are
written as citable candidates — same discipline as `DEVX-023` — not applied
anywhere.

Grounding measurement already taken 2026-08-01 (read-only, on
`C:\Dev2026\Docs\.crush\crush.db.bak`), so the worker starts past discovery,
not from zero: tool results live in `messages` rows with `role='tool'`
(63,348 of them; NOT inside the calling assistant message), each holding a
`tool_result` part with `data.name`, `data.content`, and an error flag
(`data.is_error`/`data.isError`). A first pass over the full corpus already
surfaced:

| Tool | Calls | Avg content chars | Max chars | Errors |
|---|---|---|---|---|
| `edit` | 5,056 | 162 | 18,361 | **840 (16.6%)** |
| `view` | 16,765 | 4,253 | 71,499 | 353 |
| `bash` | 26,357 | 1,128 | 59,896 | 31 |
| `mcp_git_git_branch` | 38 | 15,885 | 97,415 | 0 |
| `mcp_context7_get-library-docs` | 16 | 39,266 | 53,985 | 0 |
| `mcp_headroom_headroom_retrieve` | 183 | 5,549 | 39,680 | 0 |

These are a starting point to verify and explain, not a finished result —
this task's job is turning "840 edit errors" into "edit fails when X,
because Y," the same way `DEVX-013`'s triage turned failing test names into
diagnosed root causes.

## Acceptance

- [ ] `tools/corpus-learning/extract-tool-usage-stats.mjs` reads
      **read-only** across both `C:\Dev2026\Docs\.crush\crush.db.bak` (the
      corpus of record, 725 sessions / 115,170 messages) and the live
      `crush.db` (9 sessions, kept separate in the report, not merged silently
      into one number), and reports per tool name: call count, avg/median/max
      content size, and error rate. Same safety constraint as `DEVX-023`:
      verify the `.bak` file's size and mtime are unchanged after a full run.
- [ ] The three findings in the grounding table above are explained, not
      just re-confirmed: sample actual failed `edit` tool_results and state
      the real failure reason(s) (e.g. a specific error string pattern, not
      "it failed sometimes"); sample `mcp_git_git_branch` calls and state why
      the payload is that large relative to what a branch listing needs;
      compare `bash`'s 26,357 calls against how many of that project's own
      skills/CLAUDE.md already asked agents to prefer a dedicated tool
      instead (mirroring this project's own "prefer dedicated tools over
      Bash" guidance) — state what fraction of `bash` calls plausibly could
      have used `view`/`grep`/`glob` instead, sampled, not guessed.
- [ ] MCP and LSP tools are broken out from native tools explicitly: total
      calls, total context chars, and error rate for the `mcp_*` and `lsp_*`
      families as a group, plus a per-server breakdown (`git`, `headroom`,
      `context7`, `playwright`, `sequential-thinking`, `github`, etc.) — with
      the report stating plainly whether MCP/LSP usage is a meaningful share
      of total tool context cost or a rounding error next to `bash`/`view`.
- [ ] Every candidate finding cites a reproducible query or a specific
      session/message id a reviewer can re-run or look up directly — a
      finding without a citation is dropped, not asserted. Malformed tool
      names encountered in passing (e.g. `Edit`, `globl`, `gl`, a raw
      `apid_<uuid>` value seen in the 2026-08-01 pass) are noted as a data-
      quality aside, not chased as their own finding unless they recur often
      enough to matter.
- [ ] `docs/planning/evidence/DEVX-025-tool-usage-report.md` shapes each
      finding worth carrying forward in the same `PITFALLS.md`-ready format
      `DEVX-023` uses (Sintoma/Causa raiz/Evidência), without writing to
      `C:\Dev2026\Docs\PITFALLS.md` itself — adoption stays a human decision
      on reviewed candidates.

## Non-goals

- Do not write to anything under `C:\Dev2026\Docs\`, including
  `PITFALLS.md`. Same constraint as `DEVX-023`, same reason: the 757 MB
  `.bak` is the only copy of that history and must not be touched.
- Do not merge this with `DEVX-023`'s rework/spec-feedback extraction. That
  task reads task-file sections for qualitative learning; this task reads
  `role='tool'` message parts for tool-usage statistics. Different corpus
  slice, different method, independently verifiable.
- Do not attempt to reduce token usage or change any tool's behavior in this
  or any other codebase. This task measures the historical corpus; acting on
  a finding (e.g. changing a skill's guidance) is a separate, later decision.
- Do not build a general-purpose analytics dashboard or a repeatable
  pipeline for future sessions. One report, from the corpus as it stands
  today, is the deliverable.
- If a naming collision with `DEVX-023`'s own files under
  `tools/corpus-learning/` is discovered at dispatch time (both tasks may be
  in flight together), do not overwrite the other task's file — report the
  collision instead of guessing which one wins.

## Sources and decisions

- Measured directly 2026-08-01, read-only: `messages` table has 49,823
  `assistant` rows, 63,348 `tool` rows, 1,999 `user` rows in the `.bak`.
  Tool results are `{"type":"tool_result","data":{"tool_call_id","name",
  "content","is_error"?}}` inside `role='tool'` rows' `parts` JSON array —
  not inside the assistant message that issued the call.
- The grounding table above, and the full per-tool distinct-name listing
  (over 60 distinct names, including the `mcp_git_*`, `mcp_playwright_*`,
  `mcp_context7_*`, `mcp_headroom_*`, `mcp_sequential-thinking_*`,
  `mcp_github_*` families and `lsp_diagnostics`/`lsp_restart`/`lsp_references`)
  were captured this session and can be reproduced with the same read-only
  query pattern this task's script formalizes.
- `docs/coop/tasks/DEVX-023.md` — the sibling task on the same corpus; shares
  the read-only safety requirement and the citation discipline, but is a
  separate deliverable over a different data slice.
- `C:\Dev2026\Docs\PITFALLS.md` — the adoption-ready format
  (`## P-NNN`, `**Sintoma:**`, `**Causa raiz:**`, `**Evidência:**`,
  `**Como prevenir recorrência:**`) this report's findings are shaped to
  match, without writing to the file itself.
- This session's own `C:\Users\israe\.claude\CLAUDE.md`-adjacent guidance
  ("Prefer dedicated tools over Bash — reserve Bash for shell-only
  operations") — the comparison point for the `bash`-share finding, since
  it's a real, already-stated preference this project's own tooling
  (`rtk`) is built around.

## Plan and test mapping

1. Write the read-only extractor; confirm the `.bak` file is untouched after
   a full run. Criterion 1.
2. Sample and explain the `edit` error rate, the `mcp_git_git_branch`
   payload size, and the `bash`-vs-dedicated-tool share. Criterion 2.
3. Produce the MCP/LSP-vs-native breakdown. Criterion 3.
4. Attach a citation to every candidate; drop what can't be cited.
   Criterion 4.
5. Write the report in `PITFALLS.md`-ready shape. Criterion 5.
6. Write `test-extract-tool-usage-stats.mjs` against small fixtures (not the
   real 757 MB file), run the declared gates, and write
   `docs/planning/evidence/DEVX-025-gate.json`.

## Handoff

Worker and reviewer return evidence to the dispatcher/state owner. This task
produces candidate findings about tool/MCP/LSP usage efficiency; adopting
any of them into `PITFALLS.md`, a skill, or `AGENTS.md` guidance is a
separate human decision on reviewed material.

## Integration

- Review decision: `accept`
- Result SHA: `8fa61a4de05381a4c7c28cd02a080b98f91f21c7`
- Merge commit: `2e00d4b73`
- Gate: task/Gate Artifact validators and 18 offline analytics assertions (`exit 0`).
