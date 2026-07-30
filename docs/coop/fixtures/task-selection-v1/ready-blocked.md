---
{
  "id": "SEL-BLOCKED",
  "title": "Fixture — bloqueada",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": ["EXT-001"],
  "capabilities": [],
  "scope": {"allow": ["fixtures/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 30, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "echo ok",
      "purpose": "Fixture gate"
    }
  ]
}
---

# SEL-BLOCKED · Fixture bloqueada

## Outcome

Fixture para teste de bloqueio externo.

## Acceptance

- [ ] Deve ser excluída mesmo com prioridade P0 e dependências satisfeitas.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor → excluída por `blocked_on: EXT-001`.

## Handoff

Evidência de bloqueio.
