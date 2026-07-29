---
{
  "id": "DEVX-002",
  "title": "Consolidar o contrato Task Spec v1",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["DEVX-001"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {
    "allow": [
      "docs/coop/task-template.md",
      "docs/coop/task-spec-v1.md",
      "docs/coop/schemas/task-spec-v1.schema.json",
      "docs/coop/fixtures/task-spec-v1/**",
      "tools/coop-dev/validate-task.mjs",
      "tools/coop-dev/test-task-spec.mjs"
    ]
  },
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/test-task-spec.mjs",
      "purpose": "Provar fixtures válidas e inválidas do contrato v1"
    },
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-002.md",
      "purpose": "Validar a própria task"
    }
  ]
}
---

# DEVX-002 · Consolidar o contrato Task Spec v1

## Outcome

Entregar um contrato Task Spec v1 versionado, portátil e executável pelo
validador atual, sem criar uma segunda fonte de estado ao lado do Orca.

## Acceptance

- [ ] O contrato documenta campos, estados, transições permitidas e o
      mapeamento entre estados Coop e Run/Task/Dispatch do Orca.
- [ ] Schema, template e `validate-task.mjs` concordam sobre o mesmo contrato
      v1 e continuam aceitando as tasks DEVX já válidas.
- [ ] Fixtures cobrem pelo menos uma task válida e rejeições de estado,
      dependência, scope, gate e budget inválidos.
- [ ] O teste de contrato roda somente com Node.js padrão em Windows e Linux e
      falha se uma fixture inválida for aceita.
- [ ] Nenhum scheduler, banco, parser YAML ou dependência npm é adicionado.

## Non-goals

- Não alterar o schema SQLite ou estados internos do Orca.
- Não implementar seleção, dispatch, gates, review ou integração.
- Não criar estado mutável em Markdown além da Task Spec versionada.

## Sources and decisions

- `docs/coop/development-loop.md`
- `docs/coop/task-template.md`
- `docs/coop/DEVX-001-orchestration-gap-matrix.md`
- `apps/desktop/orca/src/main/runtime/orchestration/types.ts`
- `apps/desktop/orca/src/main/runtime/orchestration/db.ts`

## Plan and test mapping

1. Fixar o contrato v1 e o mapeamento de estados a partir das fontes.
2. Escrever fixtures que falhem no validador atual antes de endurecê-lo.
3. Ajustar schema, template e validador com a menor mudança necessária.
4. Rodar o teste de fixtures e validar todas as tasks em `docs/coop/tasks`.

## Handoff

Retornar base/result SHA, arquivos alterados, comandos com exit code e qualquer
incompatibilidade encontrada entre o contrato Coop e o estado persistido pelo
Orca.
