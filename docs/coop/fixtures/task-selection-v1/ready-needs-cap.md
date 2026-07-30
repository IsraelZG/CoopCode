---
{
  "id": "SEL-CAP",
  "title": "Fixture — requer capability",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["gpu-access"],
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

# SEL-CAP · Fixture com capability

## Outcome

Fixture para teste de capability indisponível.

## Acceptance

- [ ] Sem `gpu-access` nas capabilities, deve ser excluída.
- [ ] Com `--capabilities gpu-access,...`, deve ser elegível.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor sem `gpu-access` → excluída.
2. Rodar seletor com `--capabilities gpu-access,repository-read,repository-write` → elegível.

## Handoff

Evidência de capability.
