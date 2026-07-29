# Conventions
- Não alterar ADR aceito silenciosamente; criar ADR substituto.
- Cada mudança prova primeiro Windows ARM64; fallback x64 emulado é rejeitado.
- Platform Spike não autoriza scheduler, Kanban, RL/DPO, memória semântica, Docker, Python, Postgres ou serviços externos.
- YAGNI: usar configuração upstream existente e adicionar dependência somente para bloqueio comprovado.
- Preservar lockfiles/manifests upstream e mudanças do usuário.
- Evidência por tarefa: plataforma, arquitetura, versões, comando, exit code, saída resumida, duração e caminho/metadados do artefato.
- Nunca registrar chaves, tokens ou `.env`; não publicar/push/deploy sem autorização.
- Estado: docs/ADRs/código em Git; tarefas/leases/eventos no SQLite do coordinator; worktrees nos workers; traces/evidências em `.context`/artifact store.