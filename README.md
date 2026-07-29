# Agentic IDE

Nome provisório para uma IDE agêntica integrada e distribuída.

## Prioridades de plataforma

1. Windows 11 ARM64 — referência e primeiro gate.
2. Windows 11 x64 — segundo gate.
3. Linux ARM64 — worker/coordinator headless e terceiro gate.

## Fase atual

Estamos no **Platform Spike**. Antes de construir scheduler, Kanban ou
aprendizado, o projeto deve provar:

- toolchain nativa e reproduzível;
- runtime OpenCode em Windows ARM64;
- build do Orca e inventário de módulos nativos;
- Git, worktrees, terminal e processos filhos;
- empacotamento e smoke tests nas três plataformas.

O código upstream pesquisado permanece em `C:\Dev2026\external_repos`. Nada foi
mesclado neste repositório; documentação, contratos, skills e ferramentas
próprias vivem aqui.

## Estrutura planejada

```text
apps/
  desktop/          Electron para Windows
  web/              renderer compartilhado
services/
  coordinator/      tarefas, leases, eventos e UI web
  worker/           worktrees e execução local
packages/
  protocol/         contrato coordinator/worker
  agent-runtime/    runtime OpenCode integrado
docs/
  product/          visão e requisitos
  architecture/     arquitetura vigente
  adr/              decisões imutáveis
  planning/         backlog humano
.context/
  plans/            DAG legível por máquina
  contracts/        contratos de tarefas
  policies/         limites de autonomia
```

As pastas de código permanecem vazias até o Platform Spike determinar o
menor conjunto de dependências que funciona nativamente.

## Próximo gate

O Platform Spike terminou com decisão Go nas três plataformas. A próxima tarefa
é `DEVX-001`, que audita as primitives já existentes no Orca antes de autorizar
um coordinator/worker novo. O índice está em
[`docs/planning/task-index.md`](docs/planning/task-index.md) e o processo em
[`docs/coop/README.md`](docs/coop/README.md).
