# DEVX-025 · Tool/MCP/LSP usage analytics from the Crush session corpus

Medição 2026-08-01 (grounding) + execução integral 2026-08-02 via
`tools/corpus-learning/extract-tool-usage-stats.mjs`. Tudo abaixo é produzido
pelo script contra o corpus real — nada foi assumido; cada número é
re-executável (comandos e consultas na seção "Reprodução e consultas").

## Reprodução

```
rtk node --no-warnings tools/corpus-learning/extract-tool-usage-stats.mjs
```

- `BAK_DB_PATH` = `C:/Dev2026/Docs/.crush/crush.db.bak` (corpus de registro)
- `LIVE_DB_PATH` = `C:/Dev2026/Docs/.crush/crush.db` (corpus vivo, separado)
- Ambiente: `win32`/`arm64`, Node `v22.20.0` (node:sqlite nativo), run
  2026-08-02T00:40:09Z.
- Saída: JSON com `meta`, `bak` e `live` — seções independentes, nunca
  mescladas.

## Garantia read-only (critério 1)

O `.bak` (única cópia do histórico, 757 MB) foi aberto com
`new DatabaseSync(path, { readOnly: true })` e verificado antes/depois da
execução completa:

| Métrica | Antes | Depois |
|---|---|---|
| Tamanho | 756 899 840 bytes | 756 899 840 bytes |
| mtime | 2026-07-27T18:06:47.146Z | 2026-07-27T18:06:47.146Z |

`meta.bakFileUnchanged = true` em todas as rodadas (incluindo a rodada
final). Nenhum arquivo sob `C:/Dev2026/Docs/` foi escrito, rotacionado ou
WAL-recuperado — `crush.db.bak-wal` permanece 0 bytes.

## Forma do corpus

| Métrica | `.bak` (registro) | `crush.db` (vivo) |
|---|---|---|
| Sessions | 725 | 13 |
| `role='tool'` rows / tool_results | 63 348 | 821 |
| Chars de contexto (tool_results) | 120 370 736 | 2 349 855 |

O corpus vivo cresceu de 9 (grounding, 2026-08-01) para 13 sessions
(2026-08-02) — é um sistema em uso; os números dele são reportados em
separado e nunca somados aos do `.bak`.

## Ranking por tool (top 20, corpus `.bak`)

| Tool | Calls | Erros | Err% | Avg chars | Median | Max | Total chars |
|---|---:|---:|---:|---:|---:|---:|---:|
| `bash` | 26 357 | 31 | 0.1 | 1 128 | 225 | 59 896 | 29 728 246 |
| `view` | 16 765 | 353 | 2.1 | 4 253 | 2 659 | 71 499 | 71 303 370 |
| `edit` | 5 056 | 840 | 16.6 | 162 | 115 | 18 361 | 821 394 |
| `grep` | 3 524 | 19 | 0.5 | 657 | 163 | 26 795 | 2 315 183 |
| `glob` | 2 730 | 35 | 1.3 | 218 | 30 | 9 226 | 595 328 |
| `todos` | 2 136 | 1 | 0.0 | 240 | 240 | 241 | 512 586 |
| `write` | 1 443 | 31 | 2.1 | 164 | 126 | 3 934 | 236 170 |
| `ls` | 942 | 60 | 6.4 | 4 126 | 288 | 35 667 | 3 886 283 |
| `multiedit` | 696 | 49 | 7.0 | 211 | 119 | 5 370 | 146 900 |
| `job_output` | 644 | 7 | 1.1 | 2 807 | 939 | 30 042 | 1 807 769 |
| `mcp_git_git_commit` | 320 | 2 | 0.6 | 1 536 | 1 453 | 5 272 | 491 368 |
| `mcp_git_git_add` | 294 | 0 | 0 | 817 | 546 | 25 004 | 240 232 |
| `mcp_git_git_push` | 260 | 1 | 0.4 | 184 | 156 | 376 | 47 717 |
| `agent` | 255 | 12 | 4.7 | 8 606 | 4 347 | 144 835 | 2 194 625 |
| `mcp_git_git_set_working_dir` | 224 | 1 | 0.4 | 1 509 | 1 147 | 8 529 | 337 924 |
| `mcp_headroom_headroom_retrieve` | 183 | 0 | 0 | 5 549 | 3 673 | 39 680 | 1 015 456 |
| `mcp_git_git_status` | 176 | 0 | 0 | 953 | 371 | 23 963 | 167 653 |
| `mcp_git_git_diff` | 140 | 0 | 0 | 2 972 | 519 | 83 478 | 416 036 |
| `headroom_retrieve` | 137 | 137 | 100 | 1 526 | 1 856 | 2 674 | 208 995 |
| `read_mcp_resource` | 132 | 132 | 100 | 51 | 36 | 156 | 6 777 |

**Resposta à pergunta 1 (context cost):** `view` sozinho devolve
71 303 370 chars — **59.2% de todo o contexto consumido por tool_results**;
`bash` 24.7%; `view`+`bash` = 83.9%. É a resposta com números: o maior custo
de contexto do modelo vem de ler arquivos com `view` (mediana 2 659 chars por
chamada, max 71 499), não de outputs de comandos.

## MCP/LSP vs nativo (critério 3)

| Família | Calls | % calls | Chars | % chars | Erros | Err% |
|---|---:|---:|---:|---:|---:|---:|
| Nativo | 61 147 | 96.5 | 115 115 937 | 95.6 | 1 803 | 2.9 |
| `mcp_*` | 2 114 | 3.3 | 5 242 156 | 4.4 | 19 | 0.9 |
| `lsp_*` | 87 | 0.1 | 12 643 | 0.01 | 22 | 25.3 |

Por servidor MCP:

| Servidor | Calls | Chars | % do contexto total | Erros | Tools |
|---|---:|---:|---:|---:|---:|
| `git` | 1 781 | 3 065 324 | 2.5 | 9 | 21 |
| `headroom` | 183 | 1 015 456 | 0.8 | 0 | 1 |
| `context7` | 32 | 788 549 | 0.7 | 0 | 2 |
| `playwright` | 63 | 366 336 | 0.3 | 5 | 8 |
| `sequential-thinking` | 54 | 6 429 | 0.01 | 4 | 1 |
| `github` | 1 | 62 | 0.00 | 1 | 1 |

**Veredito:** MCP/LSP NÃO é arredondamento, mas também não é o grosso: MCP
equivale a 4.4% do custo de contexto (majoritariamente o servidor `git`,
2.5% — ver achado 2), e LSP é um arredondamento (0.01% dos chars, apesar de
errar 25% das suas 87 chamadas). O custo dominante é 100% nativo
(`view`+`bash`+`grep`+`ls`+`agent`).

---

## Achado 1 — `edit` falha em 16.6% das chamadas; o motivo não é "falha às vezes" (critério 2)

Das 5 056 chamadas de `edit`, 840 retornaram erro (16.6%). Todas as 840
foram classificadas por regex sobre o conteúdo real do erro (0
"unclassified"):

| Bucket | Count | % dos erros | Mensagem real observada |
|---|---:|---:|---|
| `stale-read-guard` | 478 | 56.9 | `file <path> has been modified since it was last read (mod time: ..., last read: ...)` |
| `old-string-not-found` | 216 | 25.7 | `old_string not found in file. Make sure it matches exactly, including whitespace` |
| `edit-without-read` | 78 | 9.3 | `you must read the file before editing it. Use the View tool first` |
| `no-op-edit` | 30 | 3.6 | `new content is the same as old content. No changes made.` |
| `ambiguous-match` | 16 | 1.9 | `old_string appears multiple times in the file. Please provide more context...` |
| `user-cancelled` | 5 | 0.6 | `Error: user cancelled assistant tool calling` |
| `exec-error` | 5 | 0.6 | `There was an error while executing the tool` |
| `tool-not-found` | 4 | 0.5 | `tool not found: edit. Available tools: glob, grep, ls, sourcegraph, view` |
| `malformed-json` | 4 | 0.5 | `invalid JSON input: unexpected end of JSON input` |
| `file-exists` | 2 | 0.2 | `file already exists: ...` |
| `missing-param` | 2 | 0.2 | `missing required parameter: old_string` / `file_path` |

**Por que 57% dos erros são stale-read:** o corpus é o repo de controle
MGTIA (Docs), um working tree único na `master` editado por vários agentes em
paralelo — o arquivo muda entre o `view` e o `edit` do mesmo agente, e o
guard rejeita. A amostra é dominada por `tasks/T-0NN.md`, exatamente os
arquivos que agentes paralelos tocam ao mesmo tempo (ex.: `T-004.md`,
`T-106.md`).

Citações (lookup: `SELECT id, session_id, parts FROM messages WHERE id='<id>'`
no `.bak`, read-only):

| Bucket | Exemplos de message id |
|---|---|
| `stale-read-guard` | `2224b121-d227-4156-bfaa-5ead03ad1f84` (T-004.md), `828a7395-2fc4-43e7-86dd-9e4a6f50b96c` (T-106.md) |
| `old-string-not-found` | `d8471be8-a4ee-4bea-93f4-01abe1ae908a`, `5e7c7afc-ff1f-47df-bdc4-4caa8e14a5c6` |
| `edit-without-read` | `870bbcab-baf5-42c7-87a1-04060105b8a8`, `bdc0b30d-6a17-46fe-a4c2-2120ccb9748e` |
| `no-op-edit` | `ef9fb0f2-0a14-4df7-aa41-522600b0378e`, `5f363dd1-affb-4c4b-9de3-3cce549e8c83` |
| `ambiguous-match` | `01ce60d6-1887-41c1-bdf9-c4e99f2cb97a`, `14d6f15e-ac10-4257-8da4-82b29556ade9` |
| `malformed-json` | `f59e5d1e-5988-4e60-ac69-1ec2e297022f`, `e7cd1682-2d59-491b-9b6e-e1904bc4d1b3` |
| `missing-param` | `81574095-f2cf-449b-9cb5-19101d958261`, `628b7baf-b6c2-441c-a7a7-5f4063fb17c7` |
| `tool-not-found` | `dc45082d-5a93-4903-ab03-161db38dc28e`, `45a0a693-dbbd-48c1-8915-52e1e9ebc5b0` |
| `user-cancelled` | `08f6088c-e318-4847-b7be-4ea8072acd04`, `a82ec245-b149-4f42-8e51-a3ba6ca8f31a` |

## Achado 2 — `mcp_git_git_branch` devolve 15 885 chars médios; o motivo é o `mode: list` (critério 2)

38 chamadas: min 100, mediana 8 749, média 15 885, max 97 415 chars; 24 de 38
(63%) acima de 1 000 chars.

- Chamadas pequenas (~100–160 chars) são `mode: create` / `show-current` /
  `delete` — um JSON curto com `message` ("Branch 'task/T-202' created
  successfully.").
- Chamadas grandes são `mode: list`: o servidor serializa **todos os branches**
  como JSON pretty-printed de 4 espaços, com `name`, `commitHash`, `current`,
  `ahead`, `behind` e `upstream` por branch. A maior chamada (97 415 chars,
  message `d4030d88-6204-41d0-8ad7-27b659079df1`, session
  `8946a8a3-72ac-479e-b72b-37dd1bd1a1dc`) lista **518 branches** — um repo com
  centenas de branches `task/T-*` acumuladas. Só nomes seriam ~10x menores
  (518 × ~20 chars ≈ 10 KB).

Citações de payloads grandes: `3b03f085-088f-4afa-bb0e-866f6a22f047`
(9 122 chars), `0af79a5f-10d4-4cfe-adaa-ea9815abefa7` (17 143 chars),
`d4030d88-6204-41d0-8ad7-27b659079df1` (97 415 chars / 518 branches).

## Achado 3 — `bash`: 40.6% das chamadas caem em classes com ferramenta dedicada (critério 2)

Os 26 360 comandos `bash` do corpus (extraídos dos `tool_call` das mensagens
`assistant` — a tool_result carrega a *saída*, não o comando) foram
classificados por primeiro verbo, cobertura total (não amostra):

| Classe | Count | % | Ferramenta dedicada existente? |
|---|---:|---:|---|
| `build-tooling` (node/pnpm/npm/tsc/vitest…) | 15 033 | 57.0 | Não — shell é o lugar certo |
| `git-vcs` (git status/log/diff/branch/add/commit…) | 5 899 | 22.4 | **Sim** — `mcp__git_*`; o próprio AGENTS.md deste projeto diz "git MCP (nunca bash git)" |
| `file-read` (cat/ls/head/tail/grep/find/stat…) | 4 806 | 18.2 | **Sim** — `view`/`grep`/`glob`/`ls` |
| `cd-navigation` (só `cd`) | 233 | 0.9 | Sim — parâmetro `working_dir` |
| `other` (rm/mkdir/cp, manipulação de arquivo) | 319 | 1.2 | Não — shell-only |
| `powershell` | 39 | 0.1 | Parcial |
| `external-cli` (gh/az/docker…) | 24 | 0.1 | `gh` → `mcp__github_*` |
| `echo-trivial` | 7 | 0.0 | — |

**Fração plausivelmente substituível:** `file-read` (18.2%) mapeia
diretamente em `view`/`grep`/`glob`/`ls`; somando `git-vcs` (22.4%) — classe
para a qual o repo do próprio corpus (AGENTS.md §2, "MCP/LSP — uso
preferencial (INVIOLÁVEL)") já ordena o uso de ferramenta dedicada — o total é
**10 705 de 26 360 (40.6%)**; com `cd-navigation`, **41.5%**. O resto (58–59%)
é build/teste/scripts — shell legítimo.

Base da comparação ("quantas diretivas já pedem ferramenta dedicada"):
- `C:/Dev2026/Docs/AGENTS.md` §2: **"`git` MCP (nunca `bash git ...`)"** —
  aplica-se diretamente aos 5 899 `git-vcs`.
- `C:/Dev2026/Docs/AGENTS.md` §3: "`github` MCP (nunca `gh` direto)" — 24
  comandos `gh`/CLI-externos.
- `C:/Dev2026/Docs/CLAUDE.md` (Regra de paralelismo no controle): "**NUNCA**
  `git commit`/`git push`/`git add` no Docs… enfileire" — proibição explícita
  de operações git via bash no repo de controle.
- Guidance de sessão do próprio Crush citada na task: "Prefer dedicated tools
  over Bash — reserve Bash for shell-only operations".

Exemplos citados (message id → comando):

| Message id | Comando classificado |
|---|---|
| `15ecfebf-fe79-4dad-949d-2be2080fd72a` | `cd .../T-004 && git branch --show-current` (`git-vcs`) |
| `8e439222-b41e-452d-8b5b-5adec177bdaf` | `cd ".../T-004" && git add -A && git commit -m "..."` (`git-vcs`) |
| `21a8817c-64bf-4f7a-bd97-8e19d7c88f00` | `cat "C:\Users\israe\AppData\Local\crush\crush.json"` (`file-read`) |
| `f4c456f9-5163-490a-bd12-e7e6cc1c14df` | `ls ".../packages/protocol"` (`file-read`) |
| `577b1e38-2842-4fc1-859b-cc5ba8dfd4c2` | `grep -m1 "^status:" .../T-001.md ...` (`file-read`) |

## Nota de qualidade de dados (critério 4)

72 nomes distintos de tool no `.bak`. Nomes malformados, todos ocorrência
única, registrados como aside (não vistos como achados próprios por não
recorrerem):

| Nome | Count | Provável origem |
|---|---:|---|
| `Edit` | 1 | capitalização errônea (hand-typed) |
| `globl` | 1 | typo de `glob` |
| `gl` | 1 | typo de `glob` |
| `apid_f5e34f14-06cb-42da-8b89-c2b49a2a5512` | 1 | id cru de tool_call vazado como nome |

## Candidatos PITFALLS-ready (critério 5)

Candidatos no formato de adoção do `PITFALLS.md` (`## P-NNN`, Sintoma, Causa
raiz, Evidência, Como prevenir recorrência). Numeração `P-??-DEVX-025-N` —
reservada; a numeração final é decisão humana na adoção. Nada foi escrito em
`C:/Dev2026/Docs/PITFALLS.md`.

### Candidato P-??-DEVX-025-1 · `edit` falha por stale-read em working tree compartilhado

**Sintoma:** `edit` recusa com "file ... has been modified since it was last
read" — 478 de 840 falhas de edit (56.9%); concentrado em `tasks/T-0NN.md`.

**Causa raiz:** o repo de controle é um working tree único na `master` com
vários agentes em paralelo; o mtime do arquivo muda entre o `view` e o `edit`
do mesmo agente, e o guard rejeita por design (proteção correta, acionada em
excesso pelo modelo de paralelismo).

**Evidência:** 840 erros classificados, 0 unclassified; mensagens
`2224b121-d227-4156-bfaa-5ead03ad1f84` e `828a7395-2fc4-43e7-86dd-9e4a6f50b96c`
consultáveis por `SELECT id, session_id, parts FROM messages WHERE id='<id>'`.

**Como prevenir recorrência (candidato):** re-`view` antes de re-`edit` quando
o guard acionar (retry com re-leitura) — comportamento de harness, decisão
humana.

### Candidato P-??-DEVX-025-2 · `edit` exige match byte-exato; drift de whitespace quebra

**Sintoma:** "old_string not found in file. Make sure it matches exactly,
including whitespace" — 216/840 (25.7%).

**Causa raiz:** a ferramenta exige reprodução byte-exata (espaços, indentação,
CRLF); modelos menores derivam do texto visto (espelham `view` que normaliza
algo, ou erram contagem de espaços).

**Evidência:** mensagens `d8471be8-a4ee-4bea-93f4-01abe1ae908a`,
`5e7c7afc-ff1f-47df-bdc4-4caa8e14a5c6`.

**Como prevenir recorrência (candidato):** re-`view` do trecho exato antes do
retry; `multiedit` com mais contexto; aceitar menor diff.

### Candidato P-??-DEVX-025-3 · `edit` sem `view` prévio após compactação de contexto

**Sintoma:** "you must read the file before editing it. Use the View tool
first" — 78/840 (9.3%).

**Causa raiz:** compactação/auto-summarize da sessão descarta o estado de
leitura; o guard exige `view` no estado atual da sessão.

**Evidência:** mensagens `870bbcab-baf5-42c7-87a1-04060105b8a8`,
`bdc0b30d-6a17-46fe-a4c2-2120ccb9748e`.

**Como prevenir recorrência (candidato):** após compactação, re-`view` antes
do primeiro `edit` do arquivo.

### Candidato P-??-DEVX-025-4 · `mcp_git_git_branch` despeja payload gigante no `mode: list`

**Sintoma:** chamada média de `mcp_git_git_branch` devolve 15 885 chars; max
97 415 (63% das chamadas > 1 000 chars); servidor `git` = 2.5% de TODO o
contexto do corpus (3 065 324 chars).

**Causa raiz:** `mode: list` serializa todos os branches com metadados
(`name`, `commitHash`, `current`, `ahead`, `behind`, `upstream`) em JSON
pretty-printed — 518 branches na maior chamada; listas de branch são
invocadas com frequência e poderiam ser só nomes.

**Evidência:** `d4030d88-6204-41d0-8ad7-27b659079df1` (97 415 chars, 518
branches); `0af79a5f-10d4-4cfe-adaa-ea9815abefa7` (17 143).

**Como prevenir recorrência (candidato):** compactar saída de `mode: list`
(só nomes/current), ou `headroom`-comprimir a resposta.

### Candidato P-??-DEVX-025-5 · `bash` para file-read e git-vcs onde ferramenta dedicada existe

**Sintoma:** 10 705 de 26 360 comandos `bash` (40.6%) são `git-vcs` (5 899,
22.4%) ou `file-read` (4 806, 18.2%) — classes com `mcp__git_*` / `view` /
`grep` / `glob` / `ls` disponíveis, e o AGENTS.md do próprio projeto já
ordena git via MCP.

**Causa raiz:** viés de "bash resolve tudo" do modelo; o AGENTS.md
("MCP/LSP — uso preferencial (INVIÁVEL)") existe mas nem toda sessão o
carrega/segue.

**Evidência:** classificação total (não amostra) de 26 360 comandos;
exemplos `15ecfebf-fe79-4dad-949d-2be2080fd72a`, `21a8817c-64bf-4f7a-bd97-8e19d7c88f00`,
`577b1e38-2842-4fc1-859b-cc5ba8dfd4c2`; diretiva em
`C:/Dev2026/Docs/AGENTS.md` §2/§3 e `CLAUDE.md` (regra de paralelismo).

**Como prevenir recorrência (candidato):** adoção dos candidatos em skills /
guidance — decisão humana separada (non-goal desta task agir).

### Candidato P-??-DEVX-025-6 · `view` é 59% do custo de contexto

**Sintoma:** `view` devolve 71 303 370 chars (59.2% de todo o contexto de
tool_results; mediana 2 659, max 71 499 — message
`184aff72-791f-4d61-a4fc-6ea21204373f`).

**Causa raiz:** leitura de arquivos inteiros sem `offset`/`limit`; o custo
não vem de ferramentas exóticas, e sim da leitura principal de arquivos.

**Evidência:** tabela de ranking acima; `SELECT` do maior resultado de
`view`.

**Como prevenir recorrência (candidato):** leituras com `offset`/`limit` já
existem na ferramenta; a adoção (guidance) é decisão humana.

## Reprodução e consultas

- Extração integral: `rtk node --no-warnings
  tools/corpus-learning/extract-tool-usage-stats.mjs` (env `BAK_DB_PATH` /
  `LIVE_DB_PATH` / `OUTPUT`).
- Self-check com fixtures (sem tocar o `.bak`):
  `node tools/corpus-learning/test-extract-tool-usage-stats.mjs` — 18
  asserções, cria DBs de fixture em temp dir e os apaga.
- Lookup de qualquer citação (read-only):
  ```sql
  SELECT id, session_id, substr(parts, 1, 400) FROM messages WHERE id = '<message id>';
  ```
  no `C:/Dev2026/Docs/.crush/crush.db.bak` (abra com `node:sqlite`
  `{ readOnly: true }`).
- Classificação de erros de `edit` e de comandos `bash`: regex documentados
  em `tools/corpus-learning/extract-tool-usage-stats.mjs`
  (`classifyEditError`, `classifyBashCommand`).
