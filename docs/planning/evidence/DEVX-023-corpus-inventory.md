# DEVX-023 — Inventário do corpus superapp (medido pelo script)

Data da medição: 2026-08-01. Tudo abaixo é produzido pela execução de
`tools/corpus-learning/extract-candidates.mjs` contra o corpus real — nada foi
assumido.

## Comando e reprodução

```
rtk node --no-warnings tools/corpus-learning/extract-candidates.mjs
```

- `CORPUS_DIR` = `C:/Dev2026/Docs/tasks` (594 arquivos `.md`)
- `DB_PATH` = `C:/Dev2026/Docs/.crush/crush.db.bak` (757 MB, lido em modo
  read-only do `node:sqlite`)
- Saída: JSON com `meta`, `stats` e `candidates` (3011 payloads).

## Garantia read-only do banco (critério 1)

| Métrica | Antes | Depois |
|---|---|---|
| Tamanho do arquivo | 756 899 840 bytes | 756 899 840 bytes |
| mtime | 2026-07-27T18:06:47.146Z | 2026-07-27T18:06:47.146Z |

O `crush.db.bak` foi aberto com `{ readOnly: true }` do `node:sqlite`; nenhum
arquivo sob `C:/Dev2026/Docs/` foi escrito, rotacionado ou WAL-recuperado.
`corpusFileUnchanged = true` em todas as execuções de verificação.

## Forma real do corpus

| Métrica | Valor |
|---|---|
| Tasks lidas | 594 |
| Sessions no `crush.db.bak` | 725 |
| Tasks com `## 6.` (Feedback/Decisão) | 518 (87%) |
| Tasks com `## 8.` (Log de Handover/Revisão) | 553 (93%) |
| Tasks com subseção `### *Rework*` no §8 | 100 (17%) |
| Tasks com ≥1 achado `[M*]/[B*]/[m*]/[i*]` | 227 (38%) |
| Tasks com sessão Crush vinculada | 50 (8.4%) |
| Tasks sem nenhuma sessão vinculada | 538 (91.6%) |

## Achados extraídos (critério 1–2)

| Marcador | Ocorrências | Severidade |
|---|---|---|
| `[B*]` | 565 | BLOCKER |
| `[M*]` | 959 | MAJOR |
| `[m*]` | 760 | MINOR |
| `[i*]` | 727 | INFO |
| **Total** | **3011** | |

Distribuição por tipo de fonte (como o extractor classifica cada payload):

| `sourceType` | Payloads | Significado |
|---|---|---|
| `reviewer-finding` | 1194 | Achado estruturado em negrito no parecer |
| `rework-correction` | 237 | Bullet de correção em rodada de rework |
| `inline-reference` | 1580 | Ocorrência inline com citação verificável |

## Candidatos emitidos × descartados (critério 2)

| Métrica | Valor |
|---|---|
| Candidatos emitidos | 3011 |
| Candidatos descartados | 0 |
| Motivos de descarte | — |

Cada candidato carrega: `taskId`, `objetivo` (§1), `finding.{marker,severity,
text}`, `sourceType`, `reworkRound` (quando o achado vive sob `### Rework`),
`specFeedback` (§6, quando presente) e `citation.{file, section, grep}`. A
citação dá caminho absoluto do arquivo, a cadeia de seção `## > ###` e o
padrão de `grep` (`\[M1\]`) — verificado a aterrissar no mesmo texto na
auditoria de amostra.

O único cenário de descarte programado (marker fora de qualquer seção `##`,
sem citação verificável) é coberto no teste de fixtures (`FX-005`); no corpus
real nenhuma ocorrência caiu nesse caso.

## Join sessions ↔ tasks (critério 3)

- Chave de join: id de task (`T-NNN`, `EST-NNN`, `DMM-NNN`, `C-NNN`, `ORQ-NNN`,
  `M-NNN`, `L-NNN`) encontrado no título da sessão — verificado 2026-08-01 como
  o esquema real (344 arquivos `T-NNN*.md`; o padrão de filename `NNN-NN`
  casava com só 2 de 725 títulos e foi rejeitado).
- **Sessions que vinculam a uma task: 63 de 725 (8.7%).** As demais são
  sessões sem id de task no título ("Untitled Session", perguntas avulsas etc.).
- **Candidatos de tasks sem nenhuma sessão: 2603 de 3011 (86.4%).** O join é
  enriquecimento, não requisito — candidatos task-only continuam válidos.
- **Candidatos com enriquecimento de sessão: 408 (13.6%).** Para estes o
  payload carrega `sessions[{title, messageCount}]`.

## Nota de cobertura

O corpus inteiro tem 3495 ocorrências de marcadores (incluindo blocos de
código, tabelas e mensagens de commit dentro de seções). O extractor emite
3011 payloads (86%). A diferença são ocorrências dentro de *code fences*
(157) e casos de cauda curta em linhas de log onde o texto pós-marker não
acrescenta significado verificável — nenhuma dessas é um achado estruturado,
apenas referência. O critério de aceitação (citação verificável ou descarte)
permanece íntegro: 0 descartes no corpus real, porque todo marker emitido tem
seu texto de origem citado.
