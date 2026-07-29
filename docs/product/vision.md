# Visão do produto

## Resultado

Uma pessoa descreve um objetivo de desenvolvimento. O sistema organiza a
documentação, deriva tarefas, escolhe automaticamente quando e onde executá-las,
implementa em worktrees isoladas, valida o resultado, oferece preview no
navegador, revisa os diffs e preserva evidências para melhorar execuções futuras.

## Experiência integrada

O produto possui um único runtime agêntico baseado no OpenCode. Architect,
Planner, Executor, Verifier, Reviewer, Integrator e Learner são perfis do mesmo
runtime, selecionados automaticamente pelo estágio do workflow. O usuário não
escolhe CLIs ou agentes para cada tarefa.

## Plataformas

| Ordem | Plataforma | Papel mínimo |
|---|---|---|
| 1 | Windows 11 ARM64 | Desktop, coordinator e worker |
| 2 | Windows 11 x64 | Desktop, coordinator e worker |
| 3 | Linux ARM64 | Coordinator, worker headless e UI web |

## Fluxo completo

```text
objetivo
→ documentação
→ DAG de tarefas
→ dispatch automático
→ implementação
→ testes e build
→ preview
→ code review
→ integração
→ aprendizado baseado em evidências
```

## Restrições

- Clones e worktrees são locais a cada worker.
- Código é transferido por Git; estado operacional passa pelo coordinator.
- Um único coordinator é autoritativo no MVP.
- Execuções overnight têm orçamento, heartbeat, lease, retries e kill switch.
- Aprendizado gera propostas de regras; não altera prompts ou políticas
  automaticamente.

## Fora do Platform Spike

OpenViking, Graphify, Sift, council multiagente, compressão lossy e treinamento
DPO permanecem fora até existir uma necessidade medida.
