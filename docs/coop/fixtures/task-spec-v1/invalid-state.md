---
{
  "id": "FIX-002",
  "title": "Fixture com estado inválido",
  "state": "invalid-state",
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
      "command": "echo ok",
      "purpose": "Test gate"
    }
  ]
}
---

# FIX-002 · Estado inválido

## Outcome

Deve ser rejeitada pelo validador.

## Acceptance

- [ ] Validador rejeita estado inválido

## Non-goals

- Nada

## Sources and decisions

- `docs/coop/task-spec-v1.md`

## Plan and test mapping

1. Rodar validador → deve falhar com erro de estado

## Handoff

Evidência de rejeição.
