# Índice de tarefas

## Ordem de execução

### P0 — Platform Spike

| ID | Tarefa | Depende de |
|---|---|---|
| PLAT-001 | Inventariar host Windows ARM64 | — |
| PLAT-002 | Fixar Node 24, pnpm e Bun | PLAT-001 |
| PLAT-003 | Instalar OpenCode de forma limpa | PLAT-002 |
| PLAT-004 | Compilar OpenCode ARM64 | PLAT-003 |
| PLAT-005 | Validar `opencode serve` | PLAT-004 |
| PLAT-006 | Instalar e compilar Orca ARM64 | PLAT-002 |
| PLAT-007 | Provar integração local Orca → OpenCode | PLAT-005, PLAT-006 |
| PLAT-008 | Auditar módulos e assets nativos | PLAT-004, PLAT-006, PLAT-007 |
| PLAT-009 | Gerar packaging mínimo Windows ARM64 | PLAT-007, PLAT-008 |
| PLAT-010 | Automatizar CI Windows ARM64 | PLAT-009 |
| PLAT-011 | Repetir provas em Windows x64 | PLAT-010 |
| PLAT-012 | Repetir provas em Linux ARM64 | PLAT-011 |
| PLAT-013 | Consolidar decisão Go/No-Go | PLAT-010, PLAT-011, PLAT-012 |

Os detalhes executáveis ficam em `platform-spike.md`.

### P0.5 — Fábrica de desenvolvimento

| ID | Tarefa | Depende de |
|---|---|---|
| DEVX-001 | Auditar primitives existentes contra o ciclo distribuído | PLAT-013 |

O contrato executável está em
[`docs/coop/tasks/DEVX-001.md`](../coop/tasks/DEVX-001.md). O restante do
roadmap DEVX só será endurecido depois desse inventário, evitando duplicar
scheduler, banco ou gerenciador de worktrees já presentes no Orca.

### P1 — Vertical slice local

| ID | Tarefa | Depende de |
|---|---|---|
| CORE-001 | Definir protocolo coordinator/worker, se o gap for confirmado | PLAT-010, DEVX-001 |
| CORE-002 | Registrar worker e capabilities | CORE-001 |
| CORE-003 | Implementar fila FIFO com dependências | CORE-002 |
| CORE-004 | Criar lease, heartbeat e expiração | CORE-003 |
| CORE-005 | Criar clone/worktree local | CORE-004 |
| CORE-006 | Supervisionar sessão OpenCode | PLAT-002, CORE-005 |
| FLOW-001 | Executar tarefa e produzir diff/commit | CORE-006 |
| FLOW-002 | Executar gates de aceitação | FLOW-001 |
| FLOW-003 | Registrar evidências e finalizar tentativa | FLOW-002 |

### P2 — Duas máquinas

| ID | Tarefa | Depende de |
|---|---|---|
| DIST-001 | Conectar worker Windows x64 | PLAT-011, FLOW-003 |
| DIST-002 | Selecionar worker por capability | DIST-001 |
| DIST-003 | Recuperar lease após desconexão | DIST-002 |
| DIST-004 | Conectar worker Linux ARM64 | PLAT-012, DIST-003 |
| DIST-005 | Integrar branches por Git | DIST-004 |

### P3 — Ciclo de produto

| ID | Tarefa | Depende de |
|---|---|---|
| DOC-001 | Gerar proposta de especificação | FLOW-003 |
| DOC-002 | Derivar DAG validado | DOC-001 |
| UI-001 | Mostrar tarefas, tentativas e workers | CORE-004 |
| PREV-001 | Publicar preview autenticada | FLOW-002 |
| REV-001 | Revisar diff com perfil Reviewer | FLOW-002 |
| AUTO-001 | Executar fila overnight com budgets | DIST-005, REV-001 |
| LEARN-001 | Extrair proposta de regra de traces | AUTO-001 |

## Definição de pronto

Uma tarefa está pronta somente quando:

- critérios de aceitação foram executados;
- plataforma e arquitetura foram registradas;
- comandos e exit codes foram preservados;
- artefatos possuem caminhos reproduzíveis;
- riscos ou limitações restantes foram documentados.

## Produto separado — CoopRouter

O backlog de inferência local, CoopCloud, rede remunerada e armazenamento não
faz parte do DAG da IDE. A proposta separada está em
[`cooprouter-roadmap.md`](cooprouter-roadmap.md).
