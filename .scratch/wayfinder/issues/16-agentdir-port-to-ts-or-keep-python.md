Type: grilling
Status: resolved 2026-07-31
Blocked by: (none — frontier)

# Keep the Python AgentDir, or build an evidence recorder in TS/JS?

## Decision (2026-07-31)

**Position 2+3 combined**: port the core to TS/JS, as a module inside
`apps/desktop/orca` (not a standalone tool under `tools/`), so evidence
capture and the `gate-artifact-v1` contract are one system instead of two
that must agree. Target: `apps/desktop/orca/src/main/evidence/` (session,
run capture with exit code, claim recording, claims-vs-evidence audit) —
emitting `gate-artifact-v1` shapes directly, not a fifth parallel format.

This promotes `docs/coop/tasks/DEVX-011.md` to `ready`; see that file for the
locked-in plan. The Python install (`uv tool install agentdir-cli`, 5 managed
git hooks, `.gitignore`'s `.agentdir/` line) is decommissioned once the module
exists and is proven equivalent — not before, per `DEVX-011`'s own gates.

## Question

Ticket 15 recorded the fact: AgentDir works, and it is Python, against a
standing `AGENTS.md` rule and an unpinned toolchain. This ticket decides what
to do, and it needs a human, because it is a product and architecture call —
not an audit.

Three positions, none of them obviously right:

1. **Keep AgentDir as-is** and pin `uv` + Python in `.toolchains/`, treating
   it as a developer tool outside the reproducibility gate. Cheapest today;
   makes every future worker machine carry a Python prerequisite.
2. **Port the core to TS/JS** and run it on the Node already pinned. Nothing
   in AgentDir requires Python: the envelope store is Maildir (directories and
   files), the index is SQLite (`node:sqlite` is already used by
   `tools/coop-dev`), the hooks are shell, and the only two dependencies —
   `platformdirs` and `rich` — have trivial Node equivalents or none. The
   whole tool is 11237 lines, but the part that matters here (session,
   `run` capture with exit code, evidence envelope, claims-versus-evidence
   audit) is a fraction of that.
3. **Build it into CoopCode** rather than beside it, so that dispatch, the
   Gate Artifact contract in `docs/coop/gate-artifact-v1.md`, and the evidence
   recorder are one system instead of three that must agree.

Position 3 deserves its own scrutiny before being treated as the obvious
answer: it is the largest, and this project's recorded failure mode is
building the apparatus instead of the product. Ask whether the recorder must
live inside CoopCode to be useful, or whether that is the apparatus reflex
again.

Questions a human must answer:

- Which position, and what does that decision buy that the other two do not?
- If porting: does the port target a standalone tool under `tools/`, or a
  module inside `apps/desktop/orca`?
- What is the smallest version that would let a worker prove it ran a gate —
  is it smaller than the Gate Artifact this repo already specified in
  `DEVX-003` and has never once produced?

That last question matters most. `gate-artifact-v1` already exists as a
contract with a validator and fixtures, and zero real artifacts. An evidence
recorder that does not produce one is a fourth format nobody reconciles.

Resolving this ticket promotes `docs/coop/tasks/DEVX-011.md` from `draft` to
`ready`. That task carries the deadline: **2026-08-27**.

## Sources

- Ticket 15 on this map — the fact and its consequences.
- `docs/coop/tasks/DEVX-011.md` — the dated debt.
- `docs/coop/gate-artifact-v1.md` and
  `docs/coop/schemas/gate-artifact-v1.schema.json` — the existing, unused
  contract this must not duplicate.
