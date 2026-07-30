---
{
  "id": "SEL-P0",
  "title": "Fixture — P0 elegível",
  "state": "ready",
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

# SEL-P0 · Fixture P0

## Outcome

Fixture para teste de seleção com prioridade P0.

## Acceptance

- [ ] Deve ser elegível e priorizada sobre P1.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor com esta fixture e `ready-p1` → `SEL-P0` deve ser selecionada.

## Handoff

Evidência de seleção.
