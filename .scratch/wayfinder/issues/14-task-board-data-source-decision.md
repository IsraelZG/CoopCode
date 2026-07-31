Type: grilling
Status: open
Blocked by: (none — frontier)

# Board de tasks: banco do Orca ou event log próprio do CoopCode?

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
