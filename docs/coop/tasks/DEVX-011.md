---
{
  "id": "DEVX-011",
  "title": "Pay the AgentDir Python debt by 2026-08-27: port the evidence core into apps/desktop/orca as TS/JS",
  "state": "done",
  "lane": "standard",
  "priority": "P1",
  "risk": "routine",
  "depends_on": [],
  "blocked_on": [],
  "capabilities": ["repository-read", "repository-write"],
  "scope": {"allow": [
    "apps/desktop/orca/src/main/evidence/**",
    ".gitignore",
    "docs/adr/**",
    "AGENTS.md",
    "docs/planning/evidence/DEVX-011-gate.json"
  ]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 180, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-011.md",
      "purpose": "Validate the task contract"
    },
    {
      "command": "node tools/coop-dev/validate-gate-artifact.mjs docs/planning/evidence/DEVX-011-gate.json",
      "purpose": "Prove gate evidence is bound to the result SHA"
    },
    {
      "command": "tools/pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts src/main/evidence",
      "purpose": "Run only this task's tests, from apps/desktop/orca"
    }
  ]
}
---

# DEVX-011 · Port the AgentDir evidence core into apps/desktop/orca

## Prazo

**2026-08-27**, quatro semanas após a adoção em 2026-07-30.

Vencido sem pagamento, a adoção é revertida: desinstalar o AgentDir Python,
remover `.agentdir/`, remover os hooks gerenciados de `.git/hooks/` e a linha
do `.gitignore`. Reverter é o caminho padrão, não um castigo — o Critério 2 em
`.scratch/wayfinder/ADOPTION-CRITERIA.md` existe para que a dívida não
sobreviva indefinidamente à decisão.

Esta data vive em prosa porque o Task Spec v1 não tem campo `deadline`. Ela
não é verificável por máquina hoje; ver a limitação registrada no mesmo
arquivo de critérios.

## Decisão (ticket 16, 2026-07-31)

Portar o núcleo para TS/JS **como módulo dentro de `apps/desktop/orca`**, não
como ferramenta standalone e não mantendo o Python fixado. Alvo:
`apps/desktop/orca/src/main/evidence/` — sessão, captura de comando com exit
code, registro de claim, e auditoria claim-vs-evidência — falando
`gate-artifact-v1` nativamente em vez de um formato próprio a reconciliar
depois. Ver o resultado completo do grilling em
`.scratch/wayfinder/issues/16-agentdir-port-to-ts-or-keep-python.md`.

## Outcome

Nenhuma evidência produzida por este projeto depende de um runtime fora de
`.toolchains/` (Node), e o `AGENTS.md` descreve a realidade em vez de uma
regra que já foi quebrada.

## Acceptance

- [ ] `apps/desktop/orca/src/main/evidence/` existe com: iniciar/encerrar
      sessão, `run` capturando comando + exit code + stdout/stderr truncado,
      registrar um claim por família (test/lint/typecheck/build/doctor/
      release, espelhando `agentdir claim <family>`), e auditar claims
      registrados contra a evidência de `run` na mesma sessão — equivalente
      funcional a `agentdir claim` + `agentdir audit claims` hoje. A auditoria
      reproduz os dois casos já provados na medição adversarial do Critério 3
      (`.scratch/wayfinder/ADOPTION-CRITERIA.md`): um claim `passed` com `run`
      correspondente audita como suportado; um claim `passed` sem `run`
      correspondente audita como não suportado, com mensagem explicando por
      quê — com um teste automatizado para cada caso.
- [ ] O módulo produz um objeto compatível com
      `docs/coop/schemas/gate-artifact-v1.schema.json` diretamente a partir de
      uma sessão real (task, attempt, baseSha, resultSha, platform, arch,
      startedAt, finishedAt, gates[] com command/purpose/exitCode/criteria) —
      não um formato paralelo depois convertido.
- [ ] O `.agentdir` Python é desinstalado (`uv tool uninstall agentdir-cli`),
      os 5 hooks geridos em `.git/hooks/` são removidos, a linha `.agentdir/`
      sai do `.gitignore`, e `.agentdir/` não resta no working tree.
- [ ] `AGENTS.md:26` reflete o resultado: não há Python no projeto, sem
      ressalva a remover.
- [ ] O resultado é demonstrado em Windows 11 ARM64 com comandos copiáveis,
      rodando só com o Node de `.toolchains/`.

## Non-goals

- Não portar as 11237 linhas do AgentDir Python. O alvo é só o núcleo listado
  em Acceptance — sessão, captura, claim, auditoria.
- Não construir um formato de evidência novo. `gate-artifact-v1` já existe,
  com schema, validador e fixtures — o módulo o produz, não o substitui.
- Não alterar `docs/coop/gate-artifact-v1.md` nem seu schema.
- Não portar `index`/busca semântica, `roots`/federação entre repos, redação
  de segredos, `replay`, ou qualquer coisa em `agentdir --help` fora da lista
  de Acceptance. Se um worker futuro sentir falta de algo daqui, isso é uma
  task nova com necessidade demonstrada, não um adendo a esta.
- Não instalar nada que exija privilégio de administrador.

## Sources and decisions

- `.scratch/wayfinder/issues/15-agentdir-adopted-is-python.md` — o fato, com
  as consequências medidas: `.toolchains/` fixa Node 24, pnpm e VS BuildTools,
  e não fixa Python nem `uv`; cinco hooks gerenciados instalados; bug de
  encoding em console Windows cp1252.
- `.scratch/wayfinder/issues/16-agentdir-port-to-ts-or-keep-python.md` —
  resolvido: módulo dentro do CoopCode, não standalone, não manter Python.
- `.scratch/wayfinder/ADOPTION-CRITERIA.md` — Critério 2 (dívida datada) e o
  resultado literal da medição adversarial do Critério 3, que define o
  comportamento exigido da auditoria acima.
- `AGENTS.md:26` — a restrição violada.
- `docs/coop/gate-artifact-v1.md` e
  `docs/coop/schemas/gate-artifact-v1.schema.json` — o formato que a captura
  deve produzir; campos obrigatórios e o shape de `gates[].criteria[]`.
- `tools/coop-dev/validate-gate-artifact.mjs` — validador existente,
  reutilizável tal como está para provar o critério 3.
- Remoção dos hooks em `.git/hooks/` e a linha do `.gitignore` não passam por
  `scope.allow` — não são caminhos versionados que o validador de task audita
  como diff; ficam registrados aqui como passo do plano, não como escopo.

## Plan and test mapping

1. Escrever o módulo `evidence/` (sessão, run, claim, audit) com um teste
   unitário por comportamento — reaproveitar o par controle/adversarial já
   usado na medição do Critério 3 como o par de testes mínimo da auditoria.
   Critério 1.
2. Escrever a função que emite `gate-artifact-v1` a partir de uma sessão real
   e validar com `validate-gate-artifact.mjs`. Critério 2.
3. Desinstalar o AgentDir Python, remover hooks e a linha do `.gitignore`.
   Critério 3.
4. Atualizar `AGENTS.md:26`. Critério 4.
5. Rodar os gates declarados, registrar evidência hands-on em Windows 11
   ARM64, e escrever `docs/planning/evidence/DEVX-011-gate.json`. Critério 5.

## Handoff

Worker e reviewer devolvem evidência ao dispatcher/dono do estado, que anexa
sem reescrever tentativas anteriores. Se a data passar sem conclusão, o dono
 do estado executa a reversão descrita em **Prazo** e registra o motivo; isso
 não exige nova task.

## Integration

- Review decision: `accept`
- Result SHA: `00d7bbc91ae74b5d9528890704e0ab70bf2c0fd4`
- Merge commit: `61573396a`
- Gate: task/Gate Artifact validators and 20 evidence tests (`exit 0`).
