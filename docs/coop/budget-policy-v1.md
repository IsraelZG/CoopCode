# Budget Policy v1 — Limites e política overnight

Versão: 1.0.0
Schema: `docs/coop/policies/development-budget-v1.json`
Validador: `node tools/coop-dev/validate-budget-policy.mjs <policy.json>`

## 1. Propósito

Definir limites máximos de recursos e condições de parada para execução
autônoma (attended e unattended) antes que exista um executor overnight
completo. Esta política é a única fonte de verdade para decisões de parada;
nenhum worker ou dispatcher pode exceder os limites aqui declarados.

## 2. Estrutura

### 2.1 Perfis de budget

| Campo | Tipo | Descrição |
|---|---|---|
| `version` | string | Versão semântica da política |
| `defaults` | object | Budgets padrão por classe de risco |
| `defaults.routine` | object | Limites para tasks de rotina |
| `defaults.routine.wall_minutes` | int | Tempo máximo de wall clock por tentativa |
| `defaults.routine.attempts` | int | Número máximo de tentativas por task |
| `defaults.routine.reworks` | int | Número máximo de reworks por task |
| `defaults.high_risk` | object | Limites para tasks de alto risco |
| `defaults.high_risk.wall_minutes` | int | Tempo máximo de wall clock por tentativa |
| `defaults.high_risk.attempts` | int | Número máximo de tentativas por task |
| `defaults.high_risk.reworks` | int | Número máximo de reworks por task |

### 2.2 Janela overnight

| Campo | Tipo | Descrição |
|---|---|---|
| `overnight` | object | Configuração da janela unattended |
| `overnight.max_tasks` | int | Número máximo de tasks na janela |
| `overnight.max_concurrent_workers` | int | Workers simultâneos máximos |
| `overnight.end_time_utc` | string | Horário limite UTC (formato HH:MM) |
| `overnight.network` | string | Política de rede: `blocked`, `allowlisted` |
| `overnight.allowed_commands` | string[] | Comandos permitidos na janela |
| `overnight.allowed_write_destinations` | string[] | Paths onde escrita é permitida |
| `overnight.preserve_evidence` | bool | Preservar worktrees e artefatos ao final |

### 2.3 Ações proibidas

| Campo | Tipo | Descrição |
|---|---|---|
| `prohibited_actions` | string[] | Ações que exigem autorização explícita registrada |

Ações permanentemente proibidas sem autorização explícita registrada na janela:
`push`, `merge`, `deploy`, `payment`, `material_removal`.

### 2.4 Condições de parada

| Campo | Tipo | Descrição |
|---|---|---|
| `stop_conditions` | string[] | Condições que disparam parada imediata |

| Condição | Significado |
|---|---|
| `new_approval_required` | Aprovação humana necessária para prosseguir |
| `secret_encountered` | Chave, token ou credencial detectada |
| `scope_escape` | Worker tentou modificar path fora do scope |
| `merge_conflict` | Conflito de merge não resolvível automaticamente |
| `unknown_baseline` | Baseline SHA desconhecido ou não verificável |
| `destructive_migration` | Migração que pode causar perda de dados |
| `repeated_failure` | Falha repetida além do budget de tentativas |
| `budget_exhausted` | Wall time, tentativas ou reworks esgotados |
| `product_architecture_question` | Pergunta que altera produto ou arquitetura |

## 3. Comportamento

1. O dispatcher consulta esta política antes de cada dispatch.
2. Cada tentativa herda os limites do perfil correspondente (`routine` ou `high_risk`).
3. Ao atingir qualquer condição de parada, o dispatcher deve:
   - Interromper o worker imediatamente.
   - Preservar evidências e worktree.
   - Registrar o motivo da parada.
   - Escalar para humano se a condição exigir decisão externa.
4. Ações proibidas exigem autorização explícita registrada na janela; sua ausência
   sempre resulta em parada.

## 4. Validação

O validador (`validate-budget-policy.mjs`) verifica:

1. JSON sintaticamente válido
2. Todos os campos obrigatórios presentes com tipos corretos
3. `version` no formato semântico
4. `defaults` com inteiros positivos
5. `overnight` com campos válidos
6. `prohibited_actions` com ao menos as ações críticas
7. `stop_conditions` com ao menos as 9 condições documentadas
8. `end_time_utc` no formato HH:MM

O teste (`test-budget-policy.mjs`) valida fixtures positivas e negativas,
incluindo cada classe de parada. Nenhum teste inicia agentes, processos do
Orca ou ações externas.

## 5. Versionamento

Mudanças nesta política exigem:

1. Nova versão do arquivo de política (`development-budget-v2.json`)
2. Atualização do validador
3. Migração das fixtures
4. ADR documentando a breaking change

Alterações backward-compatible (adição de campo opcional, relaxamento de
restrição) não exigem nova versão major.
