Type: grilling
Status: open
Blocked by: (none — frontier)

# Revisar o escopo de escrita da política overnight

> Reconstruído em 2026-07-30 a partir do MAP.md e do relatório do subagente;
> o corpo original foi perdido por `git clean -fd`.

## Question

`docs/coop/policies/development-budget-v1.json` limita
`allowed_write_destinations` a `docs/` e `tools/`. Mas `DEVX-006` e `DEVX-007`
escrevem em `apps/desktop/orca/src/`, e portanto nenhuma das duas pode rodar
em janela não assistida sob a política atual. Só `DEVX-008` pode.

O humano precisa decidir: a política descreve mal a realidade e deve ser
ampliada, ou a realidade é essa mesmo e tasks de código simplesmente não rodam
overnight?

**Guarda de escopo:** resolver este ticket significa fazer a política
*descrever* a realidade de hoje. **Não** autoriza construir ou expandir
execução overnight, que está explicitamente fora de escopo neste mapa.

## Sources

- `docs/coop/policies/development-budget-v1.json`
- `docs/coop/tasks/DEVX-006.md` — a spec registra o conflito em Sources
