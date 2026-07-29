# CoopRouter — roadmap proposto

Este backlog é independente do Platform Spike do CoopCode. Ele só deve entrar
no DAG executável do produto quando o repositório `cooprouter` existir.

## Fase R0 — contratos e riscos

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| RTR-001 | Fixar limites CoopCode/CoopRouter/CoopBruma | — | ADR e diagrama de propriedade |
| RTR-002 | Definir classes `local-only`, `trusted-cloud`, `community` | RTR-001 | contrato de privacidade |
| RTR-003 | Criar matriz de licenças de engines e modelos | RTR-001 | allowlist versionada; Cactus bloqueado por padrão |
| RTR-004 | Definir manifest de adapter/runtime | RTR-001 | schema com comando, health, capabilities e recursos |
| RTR-005 | Fixar fronteiras do cliente unificado | RTR-001 | um daemon reutilizado por CoopCode e CoopRouter standalone |
| RTR-006 | Adaptar decisões criptográficas de `Docs/docs` | RTR-002, RTR-005 | threat model e contratos de identidade, compute e storage |

Gate: nenhuma engine é copiada ou forkada antes de existir contrato de adapter,
licença aprovada e spike da plataforma prioritária.

## Fase R1 — produto local

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| RTR-010 | Provar LocalAI + um Bonsai GGUF em Windows ARM64 | RTR-003, RTR-004 | build/execução, licença, hash, benchmark e health |
| RTR-011 | Implementar `cooprouterd` e supervisor mínimo | RTR-004, RTR-010 | start/stop/restart e logs sem Electron |
| RTR-012 | Implementar API OpenAI-compatible local | RTR-011 | models, chat, streaming, cancelamento e health |
| RTR-013 | Implementar tray estática resiliente | RTR-011 | estado/erro/reinício mesmo com runtime parado |
| RTR-014 | Persistir catálogo e configuração próprios | RTR-011 | banco/diretório isolados |
| RTR-015 | Integrar CoopCode somente pelo endpoint | RTR-002, RTR-012 | detecção, indicador e “Abrir Router” |
| RTR-016 | Empacotar módulo CoopRouter no CoopCode | RTR-013, RTR-015 | mesmo `cooprouterd` do instalador standalone, opt-ins separados |

Gate: CoopCode funciona sem CoopRouter; CoopRouter funciona sem CoopCode; matar
LocalAI não impede a UI de mostrar erro e reiniciá-lo; fechar a IDE não encerra
leases aceitos nem apaga storage.

## Fase R2 — engines adicionais

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| ENG-001 | Spike Colibri com inventário e SLA local | RTR-012 | adapter experimental e capability advertida |
| ENG-002 | Avaliar OmniRoute como adapter de provedores | RTR-012 | decisão manter/remover com prova de não duplicação |
| ENG-003 | Negociar e avaliar Cactus | RTR-003 | decisão técnica e licença comercial, se necessária |
| ENG-004 | Automatizar catálogo Prism por revisão/hash | RTR-003, RTR-010 | instalação pós-setup e notices |

Gate: um único catálogo externo é exposto pela API CoopRouter; engines não
implementam política de preço, reputação ou liquidação.

## Fase B1 — Bruma da própria conta

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| BRM-001 | Definir protocolo CoopBruma↔nó | RTR-002, RTR-006, RTR-012 | identidade, capabilities, leases, streaming e cancelamento |
| BRM-002 | Implementar conexão somente de saída | BRM-001 | nó atrás de NAT, sem porta pública |
| BRM-003 | Agendar entre máquinas da mesma conta | BRM-002 | roteamento e retry sem terceiros |
| BRM-004 | Medir e registrar unidades de compute | BRM-003 | ledger de auditoria sem valor financeiro |

Gate: desconexão, retry e duplicação não cobram duas vezes nem deixam jobs
órfãos; conteúdo nunca cruza contas.

## Fase C2 — comunidade por créditos

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| NET-001 | Isolar worker de payload comunitário | BRM-004 | sem tools/filesystem/egress por padrão |
| NET-002 | Implementar admissão e reputação de nós | NET-001 | quarantine, limites e revogação |
| NET-003 | Implementar verificação amostral e antifraude | NET-002 | canários, duplicação e disputas |
| NET-004 | Lançar créditos internos não sacáveis | NET-003 | ledger de dupla entrada |
| NET-005 | Adicionar servidores próprios/provedores como fallback | NET-004 | SLA e capacity floor |

Gate: somente a classe `community` entra em nós de terceiros. Conteúdo do
CoopCode não usa essa classe por padrão.

## Fase C3 — remuneração

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| PAY-001 | Revisão jurídica, fiscal, KYC e pagamentos | NET-004 | países e políticas permitidos |
| PAY-002 | Precificação por unidade verificada | PAY-001 | tabela e reservas |
| PAY-003 | Saque, chargeback e fraude financeira | PAY-002 | piloto fechado |

Gate: nenhuma promessa de remuneração antes de PAY-001.

## Fase S — armazenamento

| ID | Tarefa | Depende de | Saída |
|---|---|---|---|
| STOR-001 | Sincronizar chunks cifrados `unique` entre dispositivos da conta | BRM-003, RTR-006 | recuperação, hash de ciphertext e chaves fora do manifest |
| STOR-002 | Adicionar replicação N=3, desafios e reparo | STOR-001 | retrievability, handoff RELEASE/ACK e tolerância offline |
| STOR-003 | Definir abuso, remoção, quotas, caução e desgaste | STOR-002, PAY-001 | política operacional/jurídica |
| STOR-004 | Piloto comunitário separado | STOR-003 | storage opt-in e ledger próprio |

Gate: storage não compartilha fila, credenciais, chaves, quotas ou ledger de
jobs com inferência.
