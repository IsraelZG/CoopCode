# Critérios de adoção de skills e frameworks externos

Lista viva. Cada critério nasce de uma pergunta respondida pelo dono do
destino, não de preferência de agente. Um candidato precisa passar em todos os
critérios fixados aqui para entrar.

Alvo da avaliação: os repositórios em `C:\Dev2026\external_repos` —
BMAD-METHOD, MetaGPT, TaskWeaver, mattpocock-skills, fable-method,
self-learning-skills, vibe-kanban, agentdir, dotcontext, open-code-review,
collective-intelligence, graphify, sift-*, OmniRoute, OpenViking, headroom.

## Critério 1 — Prova em uma sessão, no host real

Fixado em 2026-07-30.

Todo candidato precisa de um **teste de aceitação executável**, que rode em
menos de cerca de 30 minutos, em **Windows 11 ARM64**, com a toolchain fixada
em `.toolchains/`. O teste é escrito **antes** de instalar, e diz o que
significa passar.

Não passa: adoção baseada em README, em estrelas no GitHub, ou em promessa de
que "depois a gente valida".

### Por que este critério

É o único que, na sessão de 2026-07-30, separou o que funcionou do que não
funcionou:

| Candidato | Teste | Resultado |
|---|---|---|
| AgentDir | capturar um comando real e mostrar exit code consultável | passou em ~4 min |
| oh-my-opencode-slim | orquestrar a TUI do OpenCode em ARM64 | teria falhado — `bun:ffi` |
| fable-judge | refutar um relatório falso plantado de propósito | ~10 min, não executado ainda |

O mesmo padrão apareceu cinco vezes no dia em gates já aprovados: `PLAT-005`
provou `serve` e não a TUI; `PLAT-009` provou empacotamento num caminho que
mudou; o smoke do build do OpenCode era `--version`; o `worker-read` nunca foi
testado com Crush; a suíte estava vermelha sem ninguém saber. Evidência
verdadeira que não cobria o caminho real.

### Como aplicar

1. Escrever o teste de aceitação e o que conta como passar.
2. Só então instalar, de preferência via subagente, sem gastar contexto do
   agente principal.
3. Registrar comando, exit code e saída literal.
4. Reprovou ou não deu para testar em 30 min: não entra, e o motivo fica
   escrito aqui.

## Critério 2 — Restrição quebrada entra sob condição, com dívida datada

Fixado em 2026-07-30.

Um candidato que passa no Critério 1 mas viola uma restrição declarada do
projeto (`AGENTS.md`, ADR, política) **entra sob condição**. A condição não é
uma intenção: é uma task no backlog, com prazo declarado e sem bloqueio, que
paga a dívida.

Vencido o prazo sem pagamento, a adoção é revertida — não renegociada.

Não passa: "entra e depois a gente resolve" sem task criada no mesmo dia.

### Por que este critério

Sem ele, cada restrição do `AGENTS.md` vira decoração. A regra que proíbe
Python e a regra que exige ARM64 nativo têm o mesmo peso no texto; se uma cai
por conveniência, a outra também cai quando der trabalho.

E "resolvemos depois" sem task datada é o padrão que encheu `C:\Dev2026\Docs`
de 44 tasks paradas.

### Caso que originou o critério

AgentDir passou no Critério 1 e viola `AGENTS.md:26` (Python sem task que
demonstre necessidade). Fica, com a dívida registrada em
`docs/coop/tasks/DEVX-011.md`, prazo **2026-08-27**. A decisão de **como**
pagar é o ticket 16.

### Limitação conhecida do contrato

O Task Spec v1 (`docs/coop/task-spec-v1.md`) **não tem campo de prazo**. Os
campos obrigatórios são `id`, `title`, `state`, `lane`, `priority`, `risk`,
`depends_on`, `blocked_on`, `capabilities`, `scope`, `profiles`, `budget` e
`gates` — nenhum expressa data-limite.

Ou seja: este critério, do jeito que está, não é verificável por máquina. O
prazo vive em prosa no corpo da task e apodrece como qualquer prosa. Se dívida
datada virar padrão, o schema precisa de um campo `deadline` e o validador
precisa recusar dívida sem data. Decisão em aberto.

## Critério 3 — Uma por vez, com efeito declarado antes

Fixado em 2026-07-30.

No máximo **um** candidato em avaliação por vez. Antes de instalar, escreve-se
o **efeito observável esperado** — uma frase, verificável. Depois mede-se se
aconteceu. Só então o próximo candidato entra na fila.

Não passa: instalar duas coleções de skills na mesma semana, ou adotar sem ter
escrito antes o que deveria mudar.

### Por que este critério

Sem ele, os Critérios 1 e 2 viram teatro. Instalando `mattpocock-skills`,
`fable-method` e `BMAD-METHOD` juntos, não há como saber qual mudou o quê — e
qualquer melhora vira justificativa para manter os três.

Vale também para o custo de contexto: cada coleção de skills adiciona
superfície de prompt, e superfície somada sem atribuição é indistinguível de
ruído.

### Formato

```
Candidato:        <nome>
Efeito esperado:  <uma frase observável, escrita ANTES>
Teste (Crit. 1):  <comando, < 30 min, ARM64, toolchain fixada>
Restrição ferida: <nenhuma | qual, e a task datada do Crit. 2>
Medido em:        <data>  Aconteceu? <sim|não>
```

### Fila atual

| Ordem | Candidato | Estado |
|---|---|---|
| 1 | AgentDir | adotado sob condição; efeito esperado **não** foi declarado antes — falha retroativa do Critério 3, registrada em vez de apagada |
| 2 | — | vaga livre; nada mais entra até a fila 1 ser medida |

O AgentDir entrou antes deste critério existir. Ele fica, mas o efeito
esperado precisa ser escrito e medido retroativamente antes de o próximo
candidato entrar: *"um relatório de agente que alega ter rodado um gate sem
tê-lo rodado é detectado."* Isso foi observado uma vez, adversarialmente, na
própria adoção — falta medir em uso real. `DEVX-006` e `DEVX-008` são a
primeira chance, porque ambas exigem Gate Artifact.

## Critérios seguintes

Em aberto. Candidatos discutidos e não escolhidos, guardados porque podem
virar critério depois: **precisa apagar algo** (ataca acumulação, mas
reprovaria capacidade genuinamente nova), **saída definida antes da entrada**
(lição do vibe-kanban, que está sendo descontinuado) e **saúde do upstream**
(licença, releases, contrato versionado).

Ver ticket 10 e seguintes em `issues/` e o item "Not yet specified" do
`MAP.md`.
