# Ciclo de desenvolvimento autônomo do CoopCentral

## Decisão

Adotar Spec-Driven Development leve, TDD pragmático e review como fronteira de
integração. Não instalar uma máquina de processo completa antes de provar o
fluxo em tarefas reais.

O processo anterior do SuperApp tinha valor em gates verificáveis, worktrees e
revisão independente, mas acumulou estados, claims, hardening manual e gates
repetidos. O novo processo preserva os invariantes e remove a cerimônia.

## Fonte de verdade

| Informação | Fonte |
|---|---|
| intenção e critérios | Task Spec versionada |
| decisões duráveis | ADR |
| código e isolamento | Git, branch e worktree |
| execução | Run/Task/Dispatch do coordinator escolhido |
| prova determinística | Gate Artifact ligado ao SHA |
| parecer | Review Decision |
| projeção/UI | estado derivado dos eventos |

SQLite, dashboard e Markdown não podem ser três fontes concorrentes.

## Três faixas

| Faixa | Quando usar | Artefato exigido |
|---|---|---|
| quick | docs, rename, configuração ou mudança trivial | critérios e gate na task |
| standard | feature/bug delimitado | Task Spec com plano e testes |
| high-risk | segurança, dinheiro, dados, arquitetura ou migração | Task Spec + ADR/threat model + aprovação humana |

Não gerar `spec.md`, `plan.md` e `tasks.md` separados para toda microalteração.
Uma feature grande é dividida em fatias verticais demonstráveis.

## Task Spec mínima

O frontmatter usa JSON, que também é YAML válido, para que o validador funcione
somente com o Node.js padrão:

```json
{
  "id": "DEVX-001",
  "title": "Auditar primitives de orquestração existentes",
  "state": "ready",
  "lane": "standard",
  "priority": "P0",
  "risk": "routine",
  "depends_on": ["PLAT-013"],
  "blocked_on": [],
  "capabilities": ["repository-read"],
  "scope": {"allow": ["docs/coop/**"]},
  "profiles": {"worker": "routine", "reviewer": "routine"},
  "budget": {"wall_minutes": 60, "attempts": 1, "reworks": 1},
  "gates": [
    {
      "command": "node tools/coop-dev/validate-task.mjs docs/coop/tasks/DEVX-001.md",
      "purpose": "Validar o contrato da task"
    }
  ]
}
```

O corpo Markdown contém outcome, 1–5 critérios de aceite, fora de escopo,
fontes/decisões, plano/testes e handoff. O schema valida estrutura; não tenta
julgar a qualidade do texto. O modelo completo está em
`docs/coop/task-template.md`.

## Estados

```text
draft → ready → working → review → done
           ↑        │        │
           │        └─ blocked
           └── rework decision
```

- `draft`: intenção ainda não executável;
- `ready`: dependências, critérios, scope, gates e budget válidos;
- `working`: uma tentativa possui lease;
- `review`: commit e Gate Artifact válidos;
- `done`: revisão aprovada e integração confirmada;
- `blocked`: exige condição externa ou decisão explícita.

Hardening é validação de `draft → ready`, não uma fila/fase separada. Rework é
uma decisão que abre nova tentativa e retorna a task a `ready`.

## Execução

1. Dispatcher seleciona uma task `ready` cujas dependências e capabilities
   estejam satisfeitas.
2. Cria uma tentativa com commit-base imutável, budget e lease.
3. Reusa a primitive do coordinator para criar/selecionar worktree.
4. Worker escreve o menor teste que demonstra o critério, observa falha,
   implementa e refatora com o teste verde.
5. Um script allowlisted executa os gates e grava um Gate Artifact.
6. Reviewer independente inspeciona spec, diff e Gate Artifact.
7. Integrador serial confirma base atual, integra e marca `done`.

TDD não é exigido para texto, CSS puramente visual, rename ou wiring sem lógica.
Segurança, dinheiro e persistência nunca dispensam teste porque parecem simples.

## Gate Artifact

Um arquivo JSON por tentativa contém:

- task, attempt, base SHA e result SHA;
- plataforma, arquitetura e versões relevantes;
- comandos allowlisted, início/fim, duração e exit code;
- resultado dos critérios;
- hashes/caminhos dos logs e artefatos;
- baseline conhecido e regressões introduzidas;
- diff fora do scope, se houver.

O reviewer não repete gates verdes presos ao mesmo SHA. Reexecuta somente quando
o artefato está ausente/stale, o ambiente é material para o risco ou a revisão
encontra uma hipótese não coberta.

## Worktrees

- Uma worktree por task de escrita concorrente.
- Paralelizar por fronteira de ownership, não apenas por arquivos diferentes.
- Checkout principal é do integrador; workers não o alteram.
- Worktree fica em disco local, nunca em filesystem de rede.
- Remoção usa `git worktree remove` ou a primitive do coordinator.
- Worktree bloqueada é preservada até o handoff registrar evidências.
- Lockfiles, migrações, portas e serviços compartilhados limitam paralelismo.

## Review e rework

O executor não aprova o próprio trabalho. O reviewer procura, nessa ordem:

1. critério não demonstrado;
2. regressão de comportamento;
3. segurança, concorrência e perda de dados;
4. mudança fora de escopo;
5. teste ausente ou que não falharia antes da implementação;
6. complexidade desnecessária.

Mudança rotineira recebe no máximo um rework. Mudança high-risk pode receber
dois. Depois disso, ou em caso de impasse semântico, vai para humano/perfil
profundo com um pacote curto de evidências.

## Política de agentes e custo

| Papel | Perfil padrão | Escalonamento |
|---|---|---|
| explorer/docs/test triage | econômico, read-only | profundo se o domínio permanecer ambíguo |
| worker delimitado | econômico | profundo para design multicomponente não resolvido |
| reviewer rotineiro | econômico, read-only | profundo para security/money/data loss |
| architect | profundo | humano para decisão de produto/autoridade externa |

O dispatcher escolhe perfil e capabilities, não uma identidade nominal de
agente. Se métricas de tokens não estiverem disponíveis, budget usa wall time,
invocações, tentativas e reworks.

## Overnight

Uma janela unattended declara:

- máximo de tasks e workers simultâneos;
- wall time, tentativas e reworks;
- comandos e destinos de escrita permitidos;
- acesso de rede;
- ações externas proibidas;
- horário limite e política de preservação.

Parar e escalar quando houver aprovação nova, segredo, scope escape, conflito
de merge, baseline desconhecido, migração destrutiva, falha repetida ou pergunta
que altere produto/arquitetura. Push, merge, deploy, pagamento ou remoção
material exigem política explícita.

## Aprendizado

Traces geram propostas, não regras automáticas. Uma nova regra/skill exige:

1. padrão observado em pelo menos três tentativas comparáveis;
2. hipótese de causa;
3. mudança mínima;
4. replay/eval contra casos anteriores;
5. aprovação antes de alterar AGENTS.md, skills ou gates.

Isso evita “aprender” um workaround acidental e endurecer novamente o processo.

## Referências

- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Git worktree](https://git-scm.com/docs/git-worktree)
- [GitHub rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- [GitHub Actions concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)
