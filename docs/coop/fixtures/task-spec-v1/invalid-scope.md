---
{
  "id": "FIX-003",
  "title": "Fixture com scope vazio",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": [],
  "scope": {"allow": []},
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

# FIX-003 · Scope vazio

## Outcome

Deve ser rejeitada pelo validador.

## Acceptance

- [ ] Validador rejeita scope.allow vazio

## Non-goals

- Nada

## Sources and decisions

- `docs/coop/task-spec-v1.md`

## Plan and test mapping

1. Rodar validador → deve falhar com erro de scope

## Handoff

Evidência de rejeição.
