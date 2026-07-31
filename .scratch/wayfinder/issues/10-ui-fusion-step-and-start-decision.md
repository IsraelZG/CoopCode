Type: grilling
Status: resolved 2026-07-31
Blocked by: (none — frontier)

# Which UI-fusion step to commit to, and when to start

## Decision (2026-07-31)

**Step 2** (purpose-built React screens over `@opencode-ai/sdk`), matching
the recommendation and matching the "own UI consuming the SDK, not embedding
Solid" preference already stated. **Starts now, in parallel** with `DEVX-011`
(AgentDir port) and `DEVX-013` (144-failure triage) — nothing in either
blocks UI work, and none of the three touch overlapping files. First slice
specified as `DEVX-014`: one real screen, session list only, no chat/write.

## Question

Decision 08 defined a 4-step ladder for combining Orca's React renderer
with OpenCode's SolidJS web UI (0: browser-pane coexistence, 1: server as
an SSE-consuming citizen, 2: purpose-built React screens over
`@opencode-ai/sdk`, 3: full fusion), with a *recommendation* to stop at
step 2. Nobody has actually committed to a step.

Two things need a human decision, not an audit:

1. **Which step** does this effort actually build toward — take the
   recommendation (step 2), stop earlier (0 or 1), or reject it and go
   further (3)?
2. **When does it start** relative to the other frontier tickets on this
   map (e.g., before or after the budget-policy revision in ticket 11, or
   after the 144-failure triage in ticket 12)?

This is a HITL grilling ticket. It must be resolved through a live
`/grilling` exchange with the person who owns the destination — an agent
must not answer either question on the human's behalf, including by
treating the step-2 recommendation as if it were already a decision.

## Sources

- Decision 08 on this map (the ladder and its recommendation).
- Decisions 03 and 04 (why the ladder question exists at all — TUI
  broken, `serve` works).
