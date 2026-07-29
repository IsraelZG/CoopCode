---
{
  "id": "DEVX-004",
  "title": "Versionar budgets e política overnight",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["DEVX-002"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {
    "allow": [
      "docs/coop/budget-policy-v1.md",
      "docs/coop/policies/development-budget-v1.json",
      "docs/coop/fixtures/budget-policy-v1/**",
      "tools/coop-dev/validate-budget-policy.mjs",
      "tools/coop-dev/test-budget-policy.mjs"
    ]
  },
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 90, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/test-budget-policy.mjs",
      "purpose": "Provar limites e casos determinísticos de parada"
    },
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-004.md",
      "purpose": "Validar a própria task"
    }
  ]
}
---

# DEVX-004 · Versionar budgets e política overnight

## Outcome

Entregar uma política v1 validável para limitar tentativas, reworks, tempo e
ações unattended antes que exista um executor overnight.

## Acceptance

- [ ] A política define limites por task e janela: wall time, tentativas,
      reworks, concorrência, quantidade de tasks e horário final.
- [ ] Casos de parada incluem aprovação nova, segredo, scope escape, conflito,
      baseline desconhecido, migração destrutiva, falha repetida e budget
      esgotado.
- [ ] Push, merge, deploy, pagamento e remoção material permanecem proibidos
      sem autorização explícita registrada na janela.
- [ ] Fixtures demonstram política válida, campos inválidos e cada classe de
      stop; o teste falha se um caso proibido for liberado.
- [ ] Validação e testes usam somente Node.js padrão e não iniciam agentes,
      processos do Orca ou ações externas.

## Non-goals

- Não implementar o loop overnight ou contabilização persistente.
- Não escolher fornecedores/modelos nominais.
- Não executar, interromper ou remunerar agentes.

## Sources and decisions

- `docs/coop/development-loop.md`
- `docs/coop/task-spec-v1.md`
- `docs/coop/DEVX-001-orchestration-gap-matrix.md`
- `skills/coop-dispatcher/SKILL.md`

## Plan and test mapping

1. Fixar defaults mínimos para rotina e high-risk sem amarrar vendor/modelo.
2. Criar fixtures de falha para todos os stop conditions.
3. Implementar contrato e validador puro.
4. Confirmar que autorizações ausentes sempre resultam em parada.

## Handoff

Retornar base/result SHA, arquivos alterados, comandos com exit code e qualquer
limite que precise de decisão humana antes da futura `DEVX-023`.
