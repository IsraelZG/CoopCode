---
{
  "id": "SEL-P1B",
  "title": "Fixture — P1 elegível (ID posterior)",
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

# SEL-P1B · Fixture P1 com ID posterior

## Outcome

Fixture para teste de desempate por ID.

## Acceptance

- [ ] Em empate de prioridade, `SEL-P1` deve ser selecionada antes de `SEL-P1B`.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor com `SEL-P1` e `SEL-P1B` → `SEL-P1` deve ser selecionada.

## Handoff

Evidência de desempate.
