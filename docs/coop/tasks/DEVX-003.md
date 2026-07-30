---
{
  "id": "DEVX-003",
  "title": "Definir o contrato Gate Artifact v1",
  "state": "done",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["DEVX-001"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {
    "allow": [
      "docs/coop/gate-artifact-v1.md",
      "docs/coop/schemas/gate-artifact-v1.schema.json",
      "docs/coop/fixtures/gate-artifact-v1/**",
      "tools/coop-dev/validate-gate-artifact.mjs",
      "tools/coop-dev/test-gate-artifact.mjs"
    ]
  },
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/test-gate-artifact.mjs",
      "purpose": "Provar fixtures e vínculo do artefato ao result SHA"
    },
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-003.md",
      "purpose": "Validar a própria task"
    }
  ]
}
---

# DEVX-003 · Definir o contrato Gate Artifact v1

## Outcome

Entregar um Gate Artifact v1 versionado e validável que ligue comandos,
critérios e evidências a uma tentativa e a um result SHA imutável.

## Acceptance

- [ ] O contrato inclui task/attempt, base e result SHA, plataforma/arquitetura,
      comandos allowlisted, timestamps, duração, exit code e critérios.
- [ ] Logs e artefatos são referenciados por caminho e hash, sem incorporar
      segredos ou depender de caminhos absolutos de uma máquina.
- [ ] O validador aceita um exemplo completo e rejeita SHA malformado, comando
      incompleto, critério ausente e result SHA diferente do esperado.
- [ ] Fixtures e teste rodam somente com Node.js padrão em Windows e Linux.
- [ ] O contrato reutiliza output/receipts do Orca, mas não executa gates nem
      cria banco, scheduler ou armazenamento de logs.

## Non-goals

- Não executar comandos ou decidir allowlist.
- Não integrar o artefato ao SQLite ou à UI.
- Não definir ainda Review Decision ou política de retenção.

## Sources and decisions

- `docs/coop/development-loop.md`
- `docs/coop/DEVX-001-orchestration-gap-matrix.md`
- `apps/desktop/orca/src/main/runtime/rpc/methods/orchestration-worker-output.ts`
- `apps/desktop/orca/src/main/runtime/orchestration/types.ts`

## Plan and test mapping

1. Derivar o menor schema que satisfaça as evidências exigidas pelo loop.
2. Criar primeiro fixtures inválidas para vínculo SHA e comandos.
3. Implementar validador e exemplo válido sem dependências externas.
4. Demonstrar validação portátil e documentar os limites do contrato.

## Handoff

Retornar base/result SHA, arquivos alterados, comandos com exit code e decisões
adiadas explicitamente para execução de gates ou Review Decision.

## Integration

- Review decision: `accept`
- Result SHA: `f1e347a10ba015d9641de742463bfbb1955e4c87`
- Merge commit: `4a96372f5fad8e1fa5fe8e17238305248656465d`
- Gates: `node tools/coop-dev/test-gate-artifact.mjs` e
  `node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-003.md`
  (`exit 0`)
