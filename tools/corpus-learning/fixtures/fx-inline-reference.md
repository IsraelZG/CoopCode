---
id: FX-003
title: "Fixture de referência inline"
status: done
complexity: 1
target_agent: frontend_agent
reviewer_agent: agile_reviewer
---

# FX-003 · Fixture de referência inline

## 1. Objetivo
Adicionar o modo Grafo de Dependências no Board do Estaleiro UI.

## 8. Log de Handover e Revisão Agile (Code Review)

### Log de Handover
- **[2026-07-20T14:44]** - *agile_reviewer* - `[Requer Refatoração]`: Rework: [M1] o cache não é invalidado quando a task muda de coluna.

### Parecer
A correção do [M1] foi implementada em `useBoardTasks.ts` e o teste E2E foi ajustado.
