---
{
  "id": "SEL-DRAFT",
  "title": "Fixture — draft",
  "state": "draft",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
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

# SEL-DRAFT · Fixture draft

## Outcome

Fixture para teste de estado não-ready.

## Acceptance

- [ ] Deve ser excluída por estado `draft`.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor → excluída por estado.

## Handoff

Evidência de rejeição de estado.
