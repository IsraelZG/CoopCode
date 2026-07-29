---
{
  "id": "DEVX-010",
  "title": "Selecionar a próxima task elegível deterministicamente",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["DEVX-002"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {
    "allow": [
      "docs/coop/task-selection-v1.md",
      "docs/coop/fixtures/task-selection-v1/**",
      "tools/coop-dev/select-task.mjs",
      "tools/coop-dev/test-select-task.mjs"
    ]
  },
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/test-select-task.mjs",
      "purpose": "Provar elegibilidade, prioridade e desempate determinístico"
    },
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-010.md",
      "purpose": "Validar a própria task"
    }
  ]
}
---

# DEVX-010 · Selecionar a próxima task elegível deterministicamente

## Outcome

Entregar um seletor puro e read-only que escolha uma Task Spec elegível sem
criar scheduler, banco, dispatch ou worktree.

## Acceptance

- [ ] O seletor aceita tasks, dependências concluídas e capabilities
      disponíveis como entradas explícitas.
- [ ] Somente tasks `ready`, sem `blocked_on`, com dependências e capabilities
      satisfeitas podem ser escolhidas.
- [ ] A ordenação usa prioridade numérica crescente e ID como desempate
      estável, produzindo o mesmo resultado independentemente da ordem dos
      arquivos.
- [ ] A saída JSON informa a task escolhida e a razão de exclusão das demais;
      nenhuma elegível produz resultado explícito, não exceção ambígua.
- [ ] Fixtures cobrem dependência, bloqueio, capability, empate e fila vazia em
      Windows e Linux usando somente Node.js padrão.

## Non-goals

- Não criar ou atualizar Run/Task/Dispatch no Orca.
- Não implementar leases, budget consumido, worktrees ou execução de agentes.
- Não criar registry de máquinas; capabilities são entrada explícita.

## Sources and decisions

- `docs/coop/development-loop.md`
- `docs/coop/task-spec-v1.md`
- `docs/coop/DEVX-001-orchestration-gap-matrix.md`
- `apps/desktop/orca/src/main/runtime/orchestration/coordinator.ts`
- `apps/desktop/orca/src/main/runtime/orchestration/db.ts`

## Plan and test mapping

1. Definir a função pura de elegibilidade e o contrato JSON de saída.
2. Escrever fixtures que falhem por dependência, bloqueio e capability.
3. Implementar ordenação e desempate sem consultar estado implícito.
4. Provar invariância à ordem de entrada e ausência de efeitos no repositório.

## Handoff

Retornar base/result SHA, arquivos alterados, comandos com exit code e quaisquer
casos que exijam estado persistido e devam ficar para tasks posteriores.
