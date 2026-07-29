# Instruções para agentes

## Fonte da verdade

- Requisitos do produto: `docs/product/`.
- Decisões arquiteturais: `docs/adr/`.
- Backlog humano: `docs/planning/`.
- DAG executável: `.context/plans/mvp.yaml`.
- Processo distribuído e papéis: `docs/coop/` e `skills/coop-*`.

Não altere uma decisão registrada em ADR silenciosamente. Proponha um novo ADR
que substitua o anterior.

## Prioridade obrigatória

Toda mudança deve funcionar primeiro em Windows 11 ARM64, depois em Windows 11
x64 e por fim em Linux ARM64. Não aceite fallback x64 emulado como evidência de
suporte nativo ARM64.

## Escopo atual

- O código ativo da IDE está em `apps/desktop/orca`.
- `external_repos` é somente leitura/consulta; nunca implemente uma task lá.
- OpenCode permanece um processo externo. Não copie seu código sem task e ADR.
- Antes de criar scheduler, banco ou worktree manager, conclua `DEVX-001`.
- Não adicione Kanban, RL/DPO, memória semântica, Docker, Python, Postgres ou
  serviços externos sem uma task que demonstre a necessidade.

## Execução

- Prefixe todo comando de shell com `rtk`.
- Use `apply_patch` para editar arquivos.
- Preserve alterações existentes.
- Registre evidências reproduzíveis: plataforma, arquitetura, versões,
  comando, exit code e caminho do artefato.
- Ao concluir cada tarefa, registre e apresente uma verificação hands-on com
  comandos copiáveis, resultado esperado e sinais claros de sucesso ou falha.
- Uma tarefa só termina quando seus critérios de aceitação forem verificados.
- Antes do dispatch, valide o contrato com
  `node tools/coop-dev/validate-task.mjs <task.md>`.

## Segurança

- Nunca registre chaves, tokens ou conteúdo de `.env`.
- Não publique, faça deploy ou push sem autorização explícita.
- Não compartilhe SQLite ou worktrees por filesystem de rede.
