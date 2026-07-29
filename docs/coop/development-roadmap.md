# Roadmap da fábrica de desenvolvimento

## Correção de rumo

O Orca de referência já possui Run, Task, Dispatch, worktrees paralelas,
execução remota, federação, observação e controle de workers. Antes de
implementar o coordinator/worker planejado no scaffold, `DEVX-001` verifica
quais primitives podem ser absorvidas ou adaptadas.

Nenhum scheduler, banco ou gerenciador de worktrees novo será criado sem gap
demonstrado.

## Fase D0 — contrato e baseline

| ID | Tarefa | Depende de | Saída verificável |
|---|---|---|---|
| DEVX-001 | Auditar primitives existentes contra o ciclo v2 | PLAT-013 | matriz requisito → código/teste/gap |
| DEVX-002 | Consolidar Task Spec v1 e estados necessários | DEVX-001 | schema + fixtures válidas/inválidas |
| DEVX-003 | Definir Gate Artifact ligado ao SHA | DEVX-001 | schema + artefato de exemplo |
| DEVX-004 | Fixar budgets e política overnight | DEVX-002 | policy versionada e casos de stop |

Gate: uma task inválida não entra em `ready`; nenhum estado duplica fonte de
verdade já presente no Run/Task/Dispatch.

## Fase D1 — um ciclo local real

| ID | Tarefa | Depende de | Saída verificável |
|---|---|---|---|
| DEVX-010 | Selecionar próxima task elegível deterministicamente | DEVX-002 | teste de dependências/prioridade |
| DEVX-011 | Iniciar tentativa na worktree existente | DEVX-010 | branch, base SHA, lease e receipt |
| DEVX-012 | Executar gate allowlisted e gravar evidência | DEVX-003, DEVX-011 | Gate Artifact validado |
| DEVX-013 | Revisar diff com agente independente | DEVX-012 | accept/rework/blocked estruturado |
| DEVX-014 | Integrar serialmente ou preservar handoff | DEVX-013 | merge aprovado ou bloqueio reproduzível |

Gate: uma mudança pequena atravessa o ciclo completo sem editar o checkout
principal e sem repetir gate verde no mesmo SHA.

## Fase D2 — autonomia limitada

| ID | Tarefa | Depende de | Saída verificável |
|---|---|---|---|
| DEVX-020 | Implementar rework como nova tentativa | DEVX-013 | máximo respeitado, sem loop |
| DEVX-021 | Implementar blocked_on e auto-retomada | DEVX-010 | dependente retoma ao fechar causa |
| DEVX-022 | Selecionar perfis de agente por risco/custo | DEVX-004 | seleção registrada e fallback |
| DEVX-023 | Rodar janela overnight local | DEVX-020, DEVX-021, DEVX-022 | três tasks, falha e rework auditáveis |

Gate: parada segura diante de pergunta, aprovação ou budget esgotado.

## Fase D3 — múltiplas máquinas

| ID | Tarefa | Depende de | Saída verificável |
|---|---|---|---|
| DEVX-030 | Mapear capabilities das máquinas | DEVX-023 | Windows ARM64/x64 e Linux ARM64 |
| DEVX-031 | Despachar usando federação existente | DEVX-030 | placement + receipt autenticado |
| DEVX-032 | Recuperar desconexão e lease expirada | DEVX-031 | retry idempotente, sem worktree duplicada |
| DEVX-033 | Integrar branches remotas serialmente | DEVX-032 | base revalidada e CI verde |

Gate: máquina coordenadora pode dormir/reconectar sem perder estado aceito.

## Fase D4 — experiência CoopCode

| ID | Tarefa | Depende de | Saída verificável |
|---|---|---|---|
| DEVX-040 | Tela spec/tarefas/tentativas | DEVX-023 | estado e bloqueio legíveis |
| DEVX-041 | Preview e verificação hands-on | DEVX-014 | browser/artefato ligado à task |
| DEVX-042 | Inbox overnight | DEVX-023 | decisões e falhas priorizadas |
| DEVX-043 | Propostas de aprendizado por traces | DEVX-023 | regra candidata + replay, sem autoaplicar |

## Depois da fábrica

1. Usar o próprio ciclo para consolidar branding e runtime OpenCode-only.
2. Criar os repositórios CoopRouter e CoopBruma.
3. Derivar seus primeiros slices de `coopcentral-program.md`.

## Não fazer ainda

- importar o backend Nexus/SuperApp congelado;
- instalar todo o Spec Kit ou OpenSpec;
- criar graph DB, RAG, memória semântica ou RL;
- criar outro gerenciador de worktrees;
- habilitar merge/deploy/pagamento unattended;
- construir CoopCentral Core antes da fase 3 do programa.
