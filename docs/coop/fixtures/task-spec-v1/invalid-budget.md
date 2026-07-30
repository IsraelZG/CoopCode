---
{
  "id": "FIX-005",
  "title": "Fixture com budget inválido",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": [],
  "scope": {"allow": ["docs/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 0, "attempts": -1, "reworks": -1},
  "gates": [
    {
      "command": "echo ok",
      "purpose": "Test gate"
    }
  ]
}
---

# FIX-005 · Budget inválido

## Outcome

Deve ser rejeitada pelo validador.

## Acceptance

- [ ] Validador rejeita budget com valores inválidos

## Non-goals

- Nada

## Sources and decisions

- `docs/coop/task-spec-v1.md`

## Plan and test mapping

1. Rodar validador → deve falhar com erro de budget

## Handoff

Evidência de rejeição.
