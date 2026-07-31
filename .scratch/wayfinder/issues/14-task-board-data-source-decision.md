Type: grilling
Status: resolved 2026-07-31
Blocked by: (none — frontier)

# Board de tasks: banco do Orca ou event log próprio do CoopCode?

## Decisão (2026-07-31)

**Event log próprio do CoopCode**, projetado a partir dos Task Specs
versionados em git (a mesma fonte que `validate-task.mjs` e
`select-task.mjs` já leem) — não do `OrchestrationDb` do Orca. As tabelas
`tasks`/`dispatch_contexts` do Orca modelam execução ao vivo de agente
(PTY-backed), um problema diferente do ciclo attempt/gate/review deste
projeto; acoplar forçaria um encaixe e amarraria o formato do Task Spec a uma
migração de schema alheia. O Kanban de agentes existente não muda — continua
vindo do Orca. Aplica-se a um futuro `DEVX-040`; nenhuma task nova se abre
só por esta decisão.

> Reconstruído em 2026-07-30; corpo original perdido por `git clean -fd`.

## Question

O board de ciclo de vida de tasks (`draft→ready→working→review→done`) pode ser
projetado do banco de orquestração do Orca (`OrchestrationDb`) ou de um event
log próprio do CoopCode. As duas fontes podem divergir — por exemplo, uma task
`dispatched` cujo terminal do agente está ocioso.

O `DEVX-005` registrou isso como trade-off e deliberadamente não escolheu.

**Escopo:** este ticket decide a *fonte de dados*, que é fundacional para mais
coisas além do board. O board visual polido continua fora de escopo.

## Sources

- `docs/coop/DEVX-005-ingestion-profile-gap-matrix.md` §1.3
- `apps/desktop/orca/src/main/runtime/orchestration/db.ts`
