---
{
  "id": "FIX-004",
  "title": "Fixture com gate sem purpose",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": [],
  "scope": {"allow": ["docs/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 30, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "echo ok"
    }
  ]
}
---

# FIX-004 · Gate sem purpose

## Outcome

Deve ser rejeitada pelo validador.

## Acceptance

- [ ] Validador rejeita gate sem campo purpose

## Non-goals

- Nada

## Sources and decisions

- `docs/coop/task-spec-v1.md`

## Plan and test mapping

1. Rodar validador → deve falhar com erro de gate

## Handoff

Evidência de rejeição.
