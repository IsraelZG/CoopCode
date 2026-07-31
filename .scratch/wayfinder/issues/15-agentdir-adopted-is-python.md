Type: task
Status: closed
Blocked by: (none)

# AgentDir was adopted and it is a Python tool

## Question

What did adopting AgentDir actually put into this project's toolchain?

## Answer

AgentDir 0.8.0 was installed on 2026-07-30 via `uv tool install agentdir-cli`
and adopted in this repository. It works: a captured command
(`node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-006.md`) and its
`exit_code=0` are recorded and queryable through `agentdir timeline` and
`agentdir report final --format json`. Its claims-versus-evidence audit was
tested adversarially and correctly reported an unsupported claim.

It is a **Python** CLI. That collides head-on with a standing rule in this
repository's own `AGENTS.md:26`:

> Não adicione Kanban, RL/DPO, memória semântica, Docker, **Python**, Postgres
> ou serviços externos sem uma task que demonstre a necessidade.

Concrete consequences, recorded so nobody rediscovers them:

- `.toolchains/` pins Node 24, pnpm and VS BuildTools. It does **not** pin
  Python or `uv`. Evidence produced through AgentDir is therefore not
  reproducible on a fresh worker without an unpinned, undocumented
  prerequisite — on a project whose first gate is a native, reproducible
  toolchain across Windows ARM64, Windows x64 and Linux ARM64.
- Adoption installed five managed git hooks (`pre-commit`, `post-commit`,
  `pre-push`, `post-checkout`, `post-merge`) into `.git/hooks/`.
- `.gitignore` gained one line: `.agentdir/`.
- `agentdir status` crashes with `UnicodeEncodeError` on a Windows cp1252
  console; the workaround is `PYTHONIOENCODING=utf-8`.
- `AGENTS.md` and `CLAUDE.md` were deliberately **not** edited; the guidance
  text AgentDir would have written lives in `.agentdir/integrations/` instead.

The human authorized the installation without knowing it was Python. The
decision of what to do about that is ticket 16, and the dated debt is
`docs/coop/tasks/DEVX-011.md`.

## Sources

- `external_repos/agentdir/pyproject.toml` — dependencies are `platformdirs`
  and `rich` only; 11237 lines of Python across 47 files.
- `AGENTS.md:26` — the standing constraint.
- `docs/planning/evidence/BASELINE.md` — the reproducibility standard this
  tension is measured against.
