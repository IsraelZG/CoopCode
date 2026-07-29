# Task completion
- Uma tarefa só termina após verificar seus critérios de aceitação e registrar evidência reproduzível em `docs/planning/evidence/`.
- Sempre conferir `rtk git status`/`rtk git diff` para preservar checkout e detectar alterações inesperadas.
- Para instalações upstream: repetir o comando para idempotência e confirmar manifests/lockfiles inalterados.
- Para artefatos ARM64: provar arquitetura nativa nos metadados/cabeçalho, executar smoke test e registrar caminho, tamanho e hash.
- Ao final de cada tarefa, incluir na evidência e na resposta uma verificação hands-on: comandos copiáveis, resultado esperado e sinais claros de sucesso/falha.
- Atualizar o status da tarefa concluída e liberar dependentes elegíveis em `.context/plans/mvp.yaml`.
- Rodar apenas os testes/builds determinísticos proporcionais à tarefa; durante Platform Spike não inventar infraestrutura ou suítes além dos smoke tests definidos.