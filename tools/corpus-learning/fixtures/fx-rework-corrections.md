---
id: FX-002
title: "Fixture de correções de rework"
status: done
complexity: 3
target_agent: backend_agent
reviewer_agent: agile_reviewer
---

# FX-002 · Fixture de correções de rework

## 1. Objetivo
Garantir que o gate pós-merge valide o theme-dark.css regenerado no build.

## 8. Log de Handover e Revisão Agile (Code Review)

### Handover do Executor:
```
✅ build:tokens | exit=0
✅ e2e styles.spec | exit=0
```

### Rework (deepseek, 2026-07-20 14:44 BRT):
- [B1] O script `build` em `design-system/package.json` não executa `build:tokens`
- [M2] A asserção do E2E não cobria o rgb(18, 18, 18)

### Parecer do Agente Revisor (Reviewer 2):
**[B1] BLOCKER — O Gate pós-merge falhou no teste E2E 'styles.spec.ts'. O build no CI falha em gerar o theme-dark.css atualizado.**
