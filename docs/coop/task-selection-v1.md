# Task Selection v1 — Algoritmo Determinístico de Elegibilidade

Versão: 1.0.0
Seletor: `tools/coop-dev/select-task.mjs`
Testes: `tools/coop-dev/test-select-task.mjs`

## 1. Propósito

O seletor v1 é uma função pura e read-only que escolhe uma Task Spec elegível
dentre um conjunto de tarefas, sem criar scheduler, banco, dispatch ou worktree.
Todas as entradas são explícitas: arquivos de task, dependências concluídas e
capabilities disponíveis.

## 2. Interface

```
node tools/coop-dev/select-task.mjs [--done ID1,ID2,...] [--capabilities CAP1,CAP2,...] task1.md [task2.md ...]
```

| Parâmetro | Obrigatório | Descrição |
|---|---|---|
| `--done` | não | IDs de tasks concluídas, separados por vírgula (default: vazio) |
| `--capabilities` | não | Capabilities disponíveis, separadas por vírgula (default: `repository-read,repository-write`) |
| `taskN.md` | ao menos um | Caminhos para arquivos de Task Spec v1 |

## 3. Regras de elegibilidade

Uma task é elegível se e somente se:

1. **Estado `ready`**: `state` no frontmatter é exatamente `"ready"`.
2. **Sem bloqueios**: `blocked_on` é um array vazio.
3. **Dependências satisfeitas**: todo ID em `depends_on` está presente em `--done`.
4. **Capabilities satisfeitas**: toda capability em `capabilities` está presente em `--capabilities`.

## 4. Ordenação e desempate

Tasks elegíveis são ordenadas por:

1. **Prioridade numérica**: o dígito de `priority` (ex: `P0` → 0, `P4` → 4), em ordem crescente (menor = mais prioritário).
2. **ID lexicográfico**: em caso de empate de prioridade, ordena-se pelo `id` (string), em ordem crescente.

A primeira task da lista ordenada é a selecionada. O resultado é determinístico e
invariante à ordem dos arquivos de entrada ou à ordem de leitura do filesystem.

## 5. Saída JSON

```json
{
  "selected": "TASK-001",
  "reason": "highest priority (P0) with smallest ID",
  "excluded": [
    {
      "id": "TASK-002",
      "reason": "state is 'review', not 'ready'"
    },
    {
      "id": "TASK-003",
      "reason": "blocked on: EXT-001"
    },
    {
      "id": "TASK-004",
      "reason": "missing dependency: DEVX-999"
    },
    {
      "id": "TASK-005",
      "reason": "missing capability: gpu-access"
    }
  ]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `selected` | `string \| null` | ID da task selecionada, ou `null` se nenhuma for elegível |
| `reason` | `string` | Justificativa da seleção: "highest priority (P{N}) with smallest ID" ou "no eligible task found" |
| `excluded` | `array` | Lista de tasks não elegíveis com motivo de exclusão |

### Motivos de exclusão

| Cenário | `reason` |
|---|---|
| Estado diferente de `ready` | `state is '{state}', not 'ready'` |
| `blocked_on` não vazio | `blocked on: {ids}` |
| Dependência não concluída | `missing dependency: {id}` |
| Capability indisponível | `missing capability: {id}` |

Cada task excluída reporta apenas o primeiro motivo encontrado na ordem de
verificação (estado → bloqueio → dependência → capability).

## 6. Casos de borda

- **Nenhuma task fornecida**: `selected: null`, `reason: "no tasks provided"`, `excluded: []`.
- **Nenhuma task elegível**: `selected: null`, `reason: "no eligible task found"`, `excluded` contém todas as tasks com seus motivos.
- **Tasks com frontmatter inválido**: reportadas como excluídas com `reason: "invalid frontmatter: {error}"` e não interrompem o processamento das demais.

## 7. Fixtures

As fixtures em `docs/coop/fixtures/task-selection-v1/` cobrem:

| Fixture | Cenário |
|---|---|
| `ready-p0.md` | Task elegível com prioridade P0 |
| `ready-p1.md` | Task elegível com prioridade P1 |
| `ready-p1-b.md` | Task elegível com prioridade P1, ID lexicograficamente posterior |
| `ready-with-dep.md` | Task com dependência `SOME-DEP` |
| `ready-blocked.md` | Task com `blocked_on: ["EXT-001"]` |
| `ready-needs-cap.md` | Task requer capability `gpu-access` |
| `draft.md` | Task em estado `draft` |
| `working.md` | Task em estado `working` |
| `review.md` | Task em estado `review` |
| `done-task.md` | Task em estado `done` |

## 8. Invariantes

- O seletor não modifica arquivos, estado persistido ou repositório.
- A mesma entrada produz a mesma saída, independentemente da plataforma ou ordem
  do filesystem.
- O seletor usa apenas Node.js padrão, sem dependências externas.
