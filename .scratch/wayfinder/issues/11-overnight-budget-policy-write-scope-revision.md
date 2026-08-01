Type: grilling
Status: resolved 2026-08-01
Blocked by: (none — frontier)

# Revisar o escopo de escrita da política overnight

## Decisão (2026-08-01)

Nem ampliar `allowed_write_destinations` nem deixar como está — **remover o
campo** e deixar a política overnight confiar no `scope.allow` que cada task
já declara e que `validate-task.mjs` já aplica. Uma lista de diretórios
permitidos que precisa ser mantida em sincronia manual com o backlog real é
exatamente o que já ficou desatualizada uma vez (o campo dizia `docs/`+`tools/`
quando `DEVX-006`/`DEVX-007` já escreviam em `apps/desktop/orca/src/`; hoje a
maioria das tasks faz o mesmo). Confirmado 2026-08-01: nenhum código lê esse
campo em tempo de execução hoje — a mudança é de documentação/validação, não
de comportamento operacional, já que execução overnight de verdade não existe
ainda. `DEVX-022` carrega a implementação.

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
