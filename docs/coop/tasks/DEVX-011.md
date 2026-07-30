---
{
  "id": "DEVX-011",
  "title": "Pay the AgentDir Python debt by 2026-08-27: no evidence may depend on an unpinned runtime",
  "state": "draft",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    ".toolchains/**",
    "tools/**",
    "docs/adr/**",
    "AGENTS.md",
    "docs/planning/evidence/DEVX-011-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 120, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-011.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-011-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    }
  ]
}
---

# DEVX-011 · Pay the AgentDir Python debt

## Prazo

**2026-08-27**, quatro semanas após a adoção em 2026-07-30.

Vencido sem pagamento, a adoção é revertida: desinstalar o AgentDir, remover
`.agentdir/`, remover os hooks gerenciados de `.git/hooks/` e a linha do
`.gitignore`. Reverter é o caminho padrão, não um castigo — o Critério 2 em
`.scratch/wayfinder/ADOPTION-CRITERIA.md` existe para que a dívida não
sobreviva indefinidamente à decisão.

Esta data vive em prosa porque o Task Spec v1 não tem campo `deadline`. Ela
não é verificável por máquina hoje; ver a limitação registrada no mesmo
arquivo de critérios.

## Outcome

Nenhuma evidência produzida por este projeto depende de um runtime fora de
`.toolchains/`, e o `AGENTS.md` descreve a realidade em vez de uma regra que
já foi quebrada.

## Acceptance

- [ ] Existe uma decisão registrada escolhendo um dos três caminhos do ticket
      16 — fixar `uv`/Python em `.toolchains/`, portar o núcleo para TS/JS
      sobre o Node já fixado, ou remover o AgentDir — com a razão escrita.
- [ ] A decisão está executada e demonstrada: se fixar, um checkout limpo
      reproduz a captura de evidência sem instalar nada manualmente; se
      portar, a captura roda com o Node de `.toolchains/`; se remover, não
      resta `.agentdir/`, hook gerenciado nem linha no `.gitignore`.
- [ ] `AGENTS.md:26` reflete o resultado: ou Python está explicitamente
      autorizado com a razão e o escopo, ou não há Python no projeto.
- [ ] Qualquer que seja o caminho, a captura de evidência produz um arquivo
      que passa em `node tools/coop-dev/validate-gate-artifact.mjs` — não um
      quinto formato paralelo ao `gate-artifact-v1`.
- [ ] O resultado é demonstrado em Windows 11 ARM64 com comandos copiáveis.

## Non-goals

- Não portar as 11237 linhas do AgentDir. Se o caminho for portar, o alvo é o
  núcleo — sessão, captura de comando com exit code, envelope de evidência e
  auditoria de claim contra evidência — não a ferramenta inteira.
- Não construir um formato de evidência novo. O `gate-artifact-v1` já existe,
  com schema, validador e fixtures.
- Não decidir se o gravador vive dentro do CoopCode; isso é o ticket 16 e o
  Não-objetivo acima limita o tamanho de qualquer resposta.
- Não alterar `docs/coop/gate-artifact-v1.md` nem seu schema.
- Não instalar nada que exija privilégio de administrador.

## Sources and decisions

- `.scratch/wayfinder/issues/15-agentdir-adopted-is-python.md` — o fato, com
  as consequências medidas: `.toolchains/` fixa Node 24, pnpm e VS BuildTools,
  e não fixa Python nem `uv`; cinco hooks gerenciados instalados; bug de
  encoding em console Windows cp1252.
- `.scratch/wayfinder/issues/16-agentdir-port-to-ts-or-keep-python.md` — os
  três caminhos e a pergunta que o humano precisa responder.
- `.scratch/wayfinder/ADOPTION-CRITERIA.md` — Critério 2, que obriga esta
  task a existir e datada.
- `AGENTS.md:26` — a restrição violada.
- `external_repos/agentdir/pyproject.toml` — dependências são apenas
  `platformdirs` e `rich`; nada exige Python.
- `docs/coop/gate-artifact-v1.md` — o formato que qualquer captura deve
  produzir.
- **Decisão exata que falta para promover a `ready`:** qual dos três caminhos
  seguir. Enquanto o ticket 16 estiver aberto, esta task permanece `draft` —
  não porque esteja bloqueada por outra task (`blocked_on` está vazio), mas
  porque a intenção ainda não é executável sem inventar a abordagem, o que a
  skill `coop-spec` proíbe.

## Plan and test mapping

1. Levar o ticket 16 ao humano numa sessão de grilling; registrar a decisão e
   promover esta task a `ready` — critério 1.
2. Executar o caminho escolhido — critério 2.
3. Ajustar `AGENTS.md` para descrever o resultado — critério 3.
4. Provar que a captura produz um Gate Artifact válido, rodando o validador
   sobre um arquivo real — critério 4.
5. Registrar evidência hands-on e escrever
   `docs/planning/evidence/DEVX-011-gate.json` — critério 5.

## Handoff

Worker e reviewer devolvem evidência ao dispatcher/dono do estado, que anexa
sem reescrever tentativas anteriores. Se a data passar sem decisão, o dono do
estado executa a reversão descrita em **Prazo** e registra o motivo; isso não
exige nova task.
