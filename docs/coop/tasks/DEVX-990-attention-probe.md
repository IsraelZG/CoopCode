---
{
  "id": "DEVX-990",
  "title": "Synthetic attention probe for DEVX-042 criterion 5",
  "state": "draft",
  "lane": "standard",
  "priority": "P2",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": ["DEVX-046"],
  "capabilities": ["repository-read"],
  "scope": {"allow": ["docs/coop/tasks/DEVX-990-attention-probe.md"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-990-attention-probe.md",
      "purpose": "Validate task contract"
    }
  ]
}
---

# DEVX-990 · Synthetic attention probe for DEVX-042 criterion 5

## Outcome

This file exists solely to prove DEVX-042's criterion 5 against a real (non-fixture) attention item. Delete it once DEVX-042 is accepted and integrated — do not let it become permanent board clutter, and do not dispatch it as real work.

## Acceptance

- [ ] Synthetic probe task for DEVX-042 criterion 5 verification.

## Non-goals

- Do not execute or dispatch this synthetic task.

## Sources and decisions

- DEVX-042 rework note (2026-08-06) — introduced as a synthetic attention probe task.

## Handoff

Delete this file after DEVX-042 integration.
