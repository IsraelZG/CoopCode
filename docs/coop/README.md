# Coop

- [Programa CoopCentral](coopcentral-program.md)
- [Ciclo de desenvolvimento autônomo](development-loop.md)
- [Roadmap da fábrica de desenvolvimento](development-roadmap.md)
- [Template de task](task-template.md)

## Kit portátil de papéis

As fontes canônicas ficam em `skills/coop-*`:

| Skill | Responsabilidade |
|---|---|
| `coop-spec` | transformar requisito em task executável |
| `coop-dispatcher` | selecionar e distribuir uma onda de tasks |
| `coop-worker` | implementar ou fazer rework de uma tentativa |
| `coop-reviewer` | revisar de forma independente e somente leitura |
| `coop-integrator` | integrar somente o SHA aprovado |

Instale os espelhos locais reconhecidos por Antigravity/Crush e Claude Code:

```powershell
node tools/coop-dev/install-skills.mjs
node tools/coop-dev/install-skills.mjs --check
```

As cópias em `.agents/skills` e `.claude/skills` são locais e ignoradas pelo
Git. Edite somente `skills/coop-*` e reinstale os espelhos.

Valide uma task antes de despachá-la:

```powershell
node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-001.md
```

Próxima task executável: [`DEVX-001`](tasks/DEVX-001.md).
