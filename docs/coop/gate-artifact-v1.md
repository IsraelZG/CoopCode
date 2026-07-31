# Gate Artifact v1

Contrato imutável de evidência de execução de gates vinculado a uma tentativa
de task e ao result SHA.

## Propósito

O Gate Artifact v1 é o registro determinístico que liga comandos, critérios e
evidências a um par (task, attempt) e a um result SHA. O reviewer o consome
para decidir sem reexecutar gates que já passaram no mesmo SHA.

## Formato

Arquivo JSON único, schema em `docs/coop/schemas/gate-artifact-v1.schema.json`.

## Campos obrigatórios

| Campo | Tipo | Descrição |
|---|---|---|
| `task` | string | Identificador da task (ex: DEVX-003) |
| `attempt` | integer ≥ 1 | Número da tentativa (1-based) |
| `baseSha` | string (40 hex) | SHA do commit base imutável |
| `resultSha` | string (40 hex) | SHA do commit de resultado |
| `platform` | string | SO (ex: win32, linux) |
| `arch` | string | Arquitetura (ex: arm64, x64) |
| `startedAt` | ISO 8601 | Início da execução dos gates |
| `finishedAt` | ISO 8601 | Fim da execução dos gates |
| `gates` | array | Resultados de cada gate executado |

## Campo `gates`

Cada entrada contém:

| Campo | Tipo | Descrição |
|---|---|---|
| `command` | string | Comando executado |
| `purpose` | string | Por que este gate foi executado |
| `exitCode` | integer | Código de saída do processo |
| `startedAt` | ISO 8601 | Início da execução |
| `finishedAt` | ISO 8601 | Fim da execução |
| `stdout` | string (opcional) | Saída padrão capturada |
| `stderr` | string (opcional) | Saída de erro capturada |
| `criteria` | array (opcional) | Critérios de aceite verificados |

Cada critério:

| Campo | Tipo | Descrição |
|---|---|---|
| `description` | string | Descrição do critério |
| `passed` | boolean | Se o critério foi satisfeito |
| `detail` | string (opcional) | Evidência adicional |

## Campos opcionais

| Campo | Tipo | Descrição |
|---|---|---|
| `nodeVersion` | string | Versão do Node.js usada |
| `logs` | array de `fileRef` | Arquivos de log referenciados |
| `artifacts` | array de `fileRef` | Artefatos produzidos |
| `baseline` | string | Baseline conhecido |
| `regressions` | string | Regressões introduzidas |
| `outOfScopeDiff` | string | Mudanças fora de escopo |

## `fileRef`

| Campo | Tipo | Descrição |
|---|---|---|
| `path` | string | Caminho relativo ao repositório |
| `sha256` | string (64 hex) | SHA-256 do conteúdo |

## Restrições

- **Sem segredos**: Nenhum campo pode conter chaves, tokens ou conteúdo de `.env`.
- **Caminhos relativos**: Todos os caminhos em `logs` e `artifacts` são relativos
  à raiz do repositório. Não são permitidos caminhos absolutos.
- **SHA imutável**: `baseSha` e `resultSha` devem ser hashes SHA-1 completos
  (40 caracteres hexadecimais minúsculos).
- **Comando completo**: Todo gate deve ter `command`, `purpose`, `exitCode`,
  `startedAt` e `finishedAt`.
- **Critérios presentes**: Se houver `criteria`, cada entrada deve ter
  `description` e `passed`.

## Vinculação do `resultSha` — leia antes de escrever este campo

`resultSha` é **fixado no momento em que os gates terminam de rodar**, antes de
o artefato ser escrito ou commitado. Depois de fixado, **nunca é atualizado**,
nem em rework, nem em resposta a um reviewer reportando "não bate com HEAD".

O motivo é estrutural, não estilístico: o commit que adiciona o arquivo do
Gate Artifact vem necessariamente *depois* do commit que ele descreve — um
commit não pode conter o próprio hash antes de existir. Se `resultSha` for
tratado como "deve ser igual ao HEAD atual", cada commit que corrige esse
campo cria um HEAD novo, tornando o campo obsoleto de novo, para sempre. Isso
já aconteceu de verdade em `DEVX-012`: cinco commits em sequência, cada um
"corrigindo" `resultSha` para o HEAD anterior, sem nunca alcançá-lo.

**Sequência correta:**

1. Terminar de rodar os gates. `git rev-parse HEAD` **agora** é o `resultSha`.
2. Escrever o Gate Artifact com esse valor.
3. Commitar o artefato. Isso cria um novo HEAD — **não** é o `resultSha`, e
   está tudo bem: o commit do artefato só descreve o commit anterior.
4. Qualquer commit adicional que só toque `docs/planning/evidence/` (uma
   correção do próprio artefato, um rework de evidência) também não muda
   `resultSha`. Só uma mudança de código real — fora de
   `docs/planning/evidence/` — justifica um novo `resultSha`, e isso é sempre
   uma nova tentativa (`attempt`), não uma edição do mesmo artefato.

**Quem verifica** (`prepare-review.mjs`, ou um reviewer manual) resolve isso
andando para trás a partir do HEAD, pulando commits que só tocam
`docs/planning/evidence/`, até achar o commit real de código — nunca comparando
contra o HEAD bruto. Se uma verificação reportar "resultSha não bate com HEAD"
sem fazer essa caminhada, **o bug é da verificação**, não do artefato: não
"corrija" o `resultSha` para o HEAD atual. Escale.

## Validação

```bash
node tools/coop-dev/validate-gate-artifact.mjs <artifact.json> [--result-sha=<sha>]
```

- Valida estrutura contra o JSON Schema.
- Verifica formato dos SHAs.
- Verifica comandos e critérios.
- Se `--result-sha` for informado, confere se `resultSha` no artefato bate.
- Exit 0 = válido, exit 1 = inválido (com mensagem de erro).

## Teste

```bash
node tools/coop-dev/test-gate-artifact.mjs
```

Roda os fixtures em `docs/coop/fixtures/gate-artifact-v1/`. Não requer
dependências externas além do Node.js padrão.

## Fixtures

| Arquivo | Esperado |
|---|---|
| `valid-complete.json` | válido |
| `invalid-malformed-sha.json` | rejeitado (SHA malformado) |
| `invalid-incomplete-command.json` | rejeitado (comando incompleto) |
| `invalid-missing-criterion.json` | rejeitado (critério sem campos obrigatórios) |
| `invalid-result-sha-mismatch.json` | rejeitado (result SHA diferente) |

## Relação com Orca

O Gate Artifact reutiliza semanticamente os campos de output/receipt do Orca
(`dispatchId` → `task`, worker state, timestamps) mas é um artefato standalone
que não depende do runtime do Orca, SQLite ou qualquer infraestrutura externa.
Não executa comandos, não decide allowlist e não persiste estado.

## Limites explícitos (non-goals)

- Não executa comandos nem decide allowlist.
- Não integra com SQLite ou UI.
- Não define Review Decision ou política de retenção.
- Não incorpora secrets ou caminhos absolutos de máquina.
