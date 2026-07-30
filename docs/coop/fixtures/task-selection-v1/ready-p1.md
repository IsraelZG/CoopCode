---
{
  "id": "SEL-P1",
  "title": "Fixture — P1 elegível",
  "state": "ready",
  "lane": "standard",
  "priority": "P1",
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

# SEL-P1 · Fixture P1

## Outcome

Fixture para teste de seleção com prioridade P1.

## Acceptance

- [ ] Deve ser elegível mas preterida por P0.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor com esta fixture e `ready-p0` → `SEL-P0` deve ser selecionada.

## Handoff

Evidência de seleção.
