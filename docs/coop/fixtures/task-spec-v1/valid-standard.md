---
{
  "id": "FIX-001",
  "title": "Fixture task válida — standard lane",
  "state": "ready",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": ["DEVX-001"],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": ["docs/coop/fixtures/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 30, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/fixtures/task-spec-v1/valid-standard.md",
      "purpose": "Validar que a fixture válida passa"
    }
  ]
}
---

# FIX-001 · Fixture task válida

## Outcome

Fixture usada pelo teste de contrato para provar que uma task bem formada passa
na validação.

## Acceptance

- [ ] A fixture é aceita pelo `validate-task.mjs`

## Non-goals

- Não implementar comportamento real

## Sources and decisions

- `docs/coop/task-spec-v1.md`

## Plan and test mapping

1. Rodar `validate-task.mjs` contra esta fixture → exit 0

## Handoff

Evidência de que a fixture válida passa.
