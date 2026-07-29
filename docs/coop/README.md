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

## Fluxo manual mínimo

### 1. Worker

Prepare branch, worktree, mirrors e o prompt curto:

```powershell
node tools/coop-dev/prepare-task.mjs docs/coop/tasks/DEVX-001.md
```

O script recusa checkout sujo, branch/worktree já existentes e task inválida.
Use `--dry-run` para visualizar a preparação sem alterar Git nem filesystem.

### 2. Reviewer

Depois do commit do worker, gere o prompt read-only com os SHAs exatos:

```powershell
node tools/coop-dev/prepare-review.mjs docs/coop/tasks/DEVX-001.md C:\Dev2026\worktrees\CoopCode\DEVX-001
```

O reviewer não cria worktree e não edita. Se decidir `rework`, passe o handoff
para um novo agente com `$coop-worker` na mesma worktree. Se decidir `accept`,
passe decisão e SHA aprovado para `$coop-integrator`. A persistência automática
desses pareceres será criada somente depois do contrato de Review Decision.

## Próxima fila

| Onda | Tasks | Condição |
|---|---|---|
| 1 | [`DEVX-002`](tasks/DEVX-002.md), [`DEVX-003`](tasks/DEVX-003.md) | `DEVX-001` aceito e integrado |
| 2 | [`DEVX-004`](tasks/DEVX-004.md), [`DEVX-010`](tasks/DEVX-010.md) | `DEVX-002` aceito e integrado |

As tasks de uma onda têm ownership separado, mas só devem rodar em paralelo
quando as dependências já estiverem concluídas.
