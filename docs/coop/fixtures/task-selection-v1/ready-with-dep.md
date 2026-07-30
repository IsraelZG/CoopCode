---
{
  "id": "SEL-DEP",
  "title": "Fixture — com dependência",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["SOME-DEP"],
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

# SEL-DEP · Fixture com dependência

## Outcome

Fixture para teste de dependência não satisfeita.

## Acceptance

- [ ] Sem `--done SOME-DEP`, deve ser excluída.
- [ ] Com `--done SOME-DEP`, deve ser elegível.

## Non-goals

- Nada.

## Sources and decisions

- `docs/coop/task-selection-v1.md`

## Plan and test mapping

1. Rodar seletor sem `SOME-DEP` → excluída.
2. Rodar seletor com `--done SOME-DEP` → elegível.

## Handoff

Evidência de dependência.
