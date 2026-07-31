Type: research
Status: open
Blocked by: (none — frontier)

# Triar as 144 falhas da suíte do Orca

> Reconstruído em 2026-07-30; corpo original perdido por `git clean -fd`.

## Question

A suíte do Orca falha em 144 testes, 49 arquivos, antes de qualquer mudança
nossa. Ninguém investigou. Alguma dessas falhas indica algo quebrado que nos
afeta, ou é ruído do snapshot importado?

Sem a resposta, a baseline diz "vermelho é normal" — e essa é a frase que faz
um worker ignorar uma quebra real.

Nota de execução: o passo 5 da skill wayfinder manda disparar subagente de
pesquisa numa branch `research/<name>`. Isso foi pulado deliberadamente na
cartografia porque o usuário proibiu criar branch. Ao resolver, decidir se a
proibição vale ainda.

## Sources

- `docs/planning/evidence/BASELINE.md`
- Reprodução: `pnpm run test` em `apps/desktop/orca`, ~16 min
