# Task Spec v1 — Contrato e Mapeamento de Estados

Versão: 1.0.0
Schema: `docs/coop/schemas/task-spec-v1.schema.json`
Template: `docs/coop/task-template.md`

## 1. Propósito

O Task Spec v1 é a única fonte de verdade portátil para uma tarefa CoopCode.
Cada arquivo `.md` em `docs/coop/tasks/` carrega o contrato completo no
frontmatter JSON e o corpo Markdown. O validador (`validate-task.mjs`) consome
apenas Node.js padrão, sem dependências externas.

## 2. Campos

### 2.1 Frontmatter (JSON)

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | string | sim | Identificador único (ex: `DEVX-002`) |
| `title` | string | sim | Resumo legível do outcome |
| `state` | enum | sim | Ver §3 Estados |
| `lane` | enum | sim | `quick`, `standard` ou `high-risk` |
| `priority` | string | sim | `P0`–`P4` |
| `risk` | enum | sim | `routine` ou `high` |
| `depends_on` | string[] | sim | IDs de tasks que devem estar `done` antes de `ready` |
| `blocked_on` | string[] | sim | Bloqueios externos (ex: aguardando acesso) |
| `capabilities` | string[] | sim | Capabilities exigidas pelo worker |
| `scope` | object | sim | `{ "allow": string[] }` — paths que o worker pode modificar |
| `profiles` | object | sim | `{ "worker": string, "reviewer": string }` |
| `budget` | object | sim | `{ "wall_minutes": int, "attempts": int, "reworks": int }` |
| `gates` | array | sim | Array de `{ "command": string, "purpose": string }` |

### 2.2 Corpo Markdown

| Seção | Obrigatória | Descrição |
|---|---|---|
| `# {id} · {title}` | sim | Título nível 1 com ID e outcome |
| `## Outcome` | sim | Um resultado observável, não lista de atividades |
| `## Acceptance` | sim | 1–5 checkboxes `- [ ]` com critérios testáveis |
| `## Non-goals` | sim | O que o worker NÃO deve fazer |
| `## Sources and decisions` | sim | Código, ADRs, contratos relevantes |
| `## Plan and test mapping` | não (quick) | Mapeamento critério → teste; obrigatório para standard/high-risk |
| `## Handoff` | sim | O que worker/reviewer devem retornar |

### 2.3 Restrições por lane

| Lane | Campos extras | Restrições |
|---|---|---|
| `quick` | — | Pode omitir `## Plan and test mapping` |
| `standard` | — | Exige `## Plan and test mapping` e ao menos 1 gate |
| `high-risk` | — | Exige `risk: high`, `## Plan and test mapping`, ao menos 1 gate |

## 3. Estados

### 3.1 Estados Coop (fonte de verdade do Markdown)

```
draft → ready → working → review → done
         ↑        │        │
         │        └─ blocked
         └── rework decision
```

| Estado | Significado |
|---|---|
| `draft` | Intenção ainda não executável; falta dependência, critério, scope ou gate |
| `ready` | Dependências satisfeitas, critérios, scope, gates e budget válidos |
| `working` | Uma tentativa possui lease ativo; worker está executando |
| `review` | Commit e Gate Artifact válidos; aguardando reviewer independente |
| `done` | Revisão aprovada e integração confirmada |
| `blocked` | Exige condição externa ou decisão explícita para prosseguir |

### 3.2 Transições permitidas

| De | Para | Condição |
|---|---|---|
| `draft` | `ready` | Hardening: todas as dependências em `done`, fields e gates válidos |
| `draft` | `blocked` | Bloqueio externo identificado durante hardening |
| `ready` | `working` | Dispatcher cria tentativa com lease |
| `ready` | `blocked` | Dependência externa surgiu após validação |
| `working` | `review` | Worker concluiu, commit + Gate Artifact válidos |
| `working` | `blocked` | Worker encontrou bloqueio intransponível |
| `review` | `done` | Reviewer aprovou e integrador confirmou merge |
| `review` | `ready` | Rework decision: reviewer solicitou correções |
| `blocked` | `ready` | Condição externa resolvida |
| `blocked` | `draft` | Escopo ou dependências precisam ser redefinidos |

### 3.3 Mapeamento Coop → Orca

O Orca gerencia `Run`, `Task` e `Dispatch` como primitivas internas. O contrato
Coop projeta esses estados em um ciclo de vida de mais alto nível:

| Estado Coop | Orca `Task.status` | Orca `Dispatch.status` | Notas |
|---|---|---|---|
| `draft` | `pending` | — | Task existe mas não está pronta para dispatch |
| `ready` | `ready` | `pending` | Task validada; dispatch pode ser criado |
| `working` | `dispatched` | `dispatched` | Dispatch ativo com worker |
| `review` | `dispatched` | `completed` | Worker concluiu; aguardando review |
| `done` | `completed` | `completed` | Integração confirmada |
| `blocked` | `blocked` | `failed` ou `circuit_broken` | Bloqueio requer intervenção |

O estado `WorkerDispatch.state` é detalhe interno do ciclo de vida do worker
(`starting → ready → ... → succeeded/failed → stopped`) e não é exposto
diretamente no contrato Coop. O coordenador Orca traduz `succeeded` para
`DispatchStatus.completed` e `failed`/`stopped`/`abandoned` para
`DispatchStatus.failed`.

## 4. Validação

O script `tools/coop-dev/validate-task.mjs` implementa a validação deste
contrato. Ele verifica:

1. Frontmatter JSON sintaticamente válido
2. Todos os campos obrigatórios presentes e com tipos corretos
3. Estado, lane e risco dentro dos conjuntos permitidos
4. `scope.allow` com ao menos um path
5. `budget` com inteiros válidos
6. `gates` com ao menos um gate para tasks `ready`
7. Corpo com 1–5 critérios de aceite em checkbox
8. Seções obrigatórias presentes

O teste de contrato (`tools/coop-dev/test-task-spec.mjs`) valida fixtures
positivas e negativas contra este mesmo script.

## 5. Versionamento

Este documento é versionado como `v1.0.0`. Mudanças no contrato exigem:

1. Nova versão do schema (`task-spec-v2.schema.json`)
2. Atualização do validador
3. Migração das tasks existentes
4. ADR documentando a breaking change

Alterações backward-compatible (adição de campo opcional, relaxamento de
restrição) não exigem nova versão major.
