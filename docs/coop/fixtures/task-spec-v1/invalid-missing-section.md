---
{
  "id": "FIX-006",
  "title": "Fixture sem seção obrigatória",
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
      "command": "echo ok",
      "purpose": "Test gate"
    }
  ]
}
---

# FIX-006 · Seção faltando

## Outcome

Deve ser rejeitada pelo validador.

## Acceptance

- [ ] O validador deve rejeitar esta task por falta de secoes obrigatorias
