# Wayfinder map — CoopCode sem terminal manual

*Tracker: local markdown (`.scratch/wayfinder/`), per
`external_repos/mattpocock-skills/skills/engineering/setup-matt-pocock-skills/issue-tracker-local.md`.
No native blocking here — see each ticket's `Blocked by:` line.*

> **Restaurado em 2026-07-30** após `git clean -fd` apagar a pasta, que estava
> untracked. `MAP.md` e os tickets 10, 15 e 16 são verbatim; os tickets 01–09
> viraram stubs com o resumo e a fonte; os tickets 11–14 foram reconstruídos.
> **Commite este diretório.** Foi criado para o conhecimento sobreviver à
> sessão e quase morreu por não estar versionado.

## Destination

Em N semanas eu abro o CoopCode e desenvolvo dentro dele, sem cair no
terminal manual.

## Notes

- **Domain:** CoopCode — an Electron desktop app on Windows 11 ARM64, built
  by vendorizing Orca's orchestration runtime (`apps/desktop/orca`) and
  integrating OpenCode as the agent substrate.
- **Skills to consult when resolving a ticket:** this repo's own
  `coop-spec` / `coop-worker` / `coop-reviewer` / `coop-integrator` /
  `coop-dispatcher` skills for anything that turns into implementation work;
  `/research`, `/grilling`, `/domain-modeling`, `/prototype` (from
  `mattpocock-skills`) for resolving wayfinder tickets themselves.
- **Adoção de ferramenta externa** segue `ADOPTION-CRITERIA.md` neste
  diretório — três critérios fixados, e uma fila que hoje está travada.
- **Standing local constraints** every session should already know before
  touching this repo:
  - Any pnpm/build/test command under `apps/desktop/orca` needs
    `npm_config_virtual_store_dir_max_length=30` set, or native rebuilds
    fail with `MSB3491` (see ticket 05).
  - Never run the full Orca suite as a gate for a task — ~16 minutes: use
    the targeted `vitest run --config config/vitest.config.ts <path>`
    command. Compare results against `docs/planning/evidence/BASELINE.md`,
    not against green (see ticket 09).
  - `docs/coop/tasks/DEVX-006.md` through `DEVX-009.md` and `DEVX-011.md` are
    existing, already-specified tasks. This map must not create tickets that
    duplicate them — only reference them where a decision ticket depends on
    one.

## Decisions so far

- [Orca already implements the orchestration primitives CoopCode needs](issues/01-orca-orchestration-primitives-exist.md) — 39 primitives EXISTING vs. 25 gaps (review, budgets/overnight, evidence/gate-artifact, integration, dispatcher/task-selection); don't reconstruct what exists.
- [`Coordinator.decompose()` is a stub, not spec→DAG](issues/02-decompose-is-a-stub.md) — corrects DEVX-001's original "EXISTING" claim; tasks must be pre-created, decomposition is unimplemented (`coordinator.ts:185-192`).
- [The OpenCode TUI does not run on this project's Windows ARM64 host](issues/03-opencode-tui-broken-on-arm64.md) — `bun:ffi dlopen()` disabled, no Bun update fixes it.
- [`opencode serve` works natively on ARM64 with a usable web UI](issues/04-opencode-serve-works-on-arm64.md) — the substrate to build on instead of the TUI.
- [A working, installed CoopCode build exists, gated on a path-length workaround](issues/05-coopcode-build-works-with-path-workaround.md) — `npm_config_virtual_store_dir_max_length=30` required; formal reproduction tracked in `DEVX-008`, not duplicated here.
- [The ai-vault reads agent sessions from SQLite, independent of PTY transport](issues/06-ai-vault-reads-sqlite-independent-of-pty.md) — 9 agents have scanners; Crush does not.
- [Write a Crush ai-vault scanner rather than switch agents](issues/07-crush-scanner-chosen-over-agent-switch.md) — specified as `DEVX-006`, not duplicated here; that task itself flags the overnight-policy conflict behind ticket 11.
- [A 4-step Orca+OpenCode UI-fusion ladder was defined, with a recommendation to stop at step 2](issues/08-ui-fusion-four-step-ladder-defined.md) — which step to actually commit to is still open (ticket 10).
- [Verification baseline registered: the Orca suite is red before any change](issues/09-baseline-registered-suite-red-before-changes.md) — 144 tests / 49 files failing at commit `bccb83b080ca789e30312882315863d8fc6e7ce1`; not yet triaged (ticket 12).
- [AgentDir was adopted and it is a Python tool](issues/15-agentdir-adopted-is-python.md) — it works and its claims audit is honest, but it collides with `AGENTS.md:26` and is not pinned in `.toolchains/`; what to do about it is ticket 16, and the dated debt is `DEVX-011`.

## Not yet specified

- **Which external skills/frameworks to adopt** from `external_repos/`
  (BMAD-METHOD, MetaGPT, TaskWeaver, mattpocock-skills, fable-method,
  self-learning-skills, vibe-kanban, dotcontext, open-code-review, and
  others). Os três critérios em `ADOPTION-CRITERIA.md` já dizem *como*
  avaliar; falta aplicar. A fila está travada até o AgentDir ser medido em
  uso real, por força do Critério 3.

## Out of scope

- **CoopRouter** — a separate effort, not part of reaching this destination.
- **SuperApp** — a separate effort.
- **Board bonito** (polished visual kanban) — ticket 14 covers only the
  underlying task-board *data source* decision, which is foundational to
  more than just a board; the visual board itself stays out of scope.
- **Execução overnight autônoma** (unattended overnight runs) — ticket 11
  covers only whether an existing policy *file* accurately describes
  today's attended-only reality; it must not be resolved by building or
  expanding overnight execution.
- **Aprendizado / DPO** — learning pipelines, trace-based proposals, model
  training. None of it is needed to reach "eu abro o CoopCode e
  desenvolvo dentro dele."
