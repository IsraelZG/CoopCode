# Programa CoopCentral

## Objetivo

CoopCentral é o programa maior. Seus três primeiros produtos formam um MVP
deliberadamente construído com componentes existentes:

- **CoopCode:** IDE agêntica e fábrica de desenvolvimento autônomo;
- **CoopRouter:** inferência, compute e storage locais, com compartilhamento
  explicitamente autorizado;
- **CoopBruma:** provedor OpenAI-compatible que combina servidores próprios,
  provedores externos e recursos oferecidos por usuários.

CoopCode é o chamariz e acelera a construção dos demais produtos. CoopRouter e
CoopBruma são as primeiras linhas potenciais de receita.

O destino posterior é uma base híbrida P2P para um ecossistema de aplicações:
rede social, marketplace, fintech e outros módulos CoopCentral.

## Estratégia de duas bases

O MVP não tentará antecipar a base P2P definitiva. Ele usa upstreams, processos
e protocolos existentes, mantendo apenas contratos que facilitem a migração:

- OpenAI-compatible entre consumidores e provedores de inferência;
- Task/Attempt/Gate entre orquestrador e workers;
- leases e capabilities entre CoopBruma e CoopRouter;
- manifests cifrados entre clientes e storage;
- identidade de dispositivo e consentimentos separados por capacidade.

Esses contratos são seams de migração, não uma tentativa de implementar o
CoopCentral Core antes da hora. A futura reescrita substitui implementações por
trás deles.

## Roadmap macro

### 1. CoopCode — fábrica de desenvolvimento

Usar Orca como base de referência/fork e manter OpenCode como runtime agêntico
principal. Reusar suas primitives de Run, Task, Dispatch, worktrees,
SSH/federação, observação e controle de workers antes de criar equivalentes.

Entregável:

- criar uma spec curta e derivar tarefas;
- selecionar trabalho elegível automaticamente;
- executar em worktree isolado;
- usar TDD quando houver comportamento verificável;
- produzir gate determinístico ligado ao commit;
- revisar com agente independente;
- limitar rework e escalar decisões;
- operar uma fila unattended/overnight;
- mostrar preview, diff, testes, revisão e bloqueios na IDE.

Gate de saída: três tarefas reais, incluindo uma falha e um rework, terminam
overnight sem alterar o checkout principal e sem intervenção para escolher
manualmente cada agente.

### 2. CoopRouter + CoopBruma — receita inicial

CoopRouter nasce local e standalone, mas pode ser instalado como módulo do
CoopCode. `cooprouterd` continua sendo processo, banco, chaves e ciclo de vida
separados.

Ordem:

1. inferência local;
2. roteamento entre máquinas da mesma conta;
3. compute comunitário com créditos fechados;
4. storage cifrado entre dispositivos da mesma conta;
5. compute e storage comunitários;
6. liquidação financeira após gates jurídicos, fiscais e antifraude.

CoopBruma possui o gateway público, admissão, leases, scheduler, reputação,
ledger, políticas e fallback para capacidade própria/externa.

Gate de saída: uma chamada OpenAI-compatible pode ser atendida localmente,
pela CoopBruma própria ou por um CoopRouter elegível, com classe de privacidade,
medição e fallback auditáveis.

### 3. CoopCentral Core + Design System

Construir a base híbrida P2P a partir das especificações anteriores do
SuperApp, reduzidas a um primeiro vertical slice:

- identidade e delegação de dispositivo;
- transporte autenticado e sincronização local-first;
- autorização por capability;
- armazenamento de conteúdo cifrado;
- contratos de módulos/apps;
- design system compartilhado.

Gate de saída: dois dispositivos sincronizam um módulo mínimo offline/online,
com revogação e recuperação demonstráveis.

### 4. Migração dos três produtos

Migrar por seam, não por big bang:

1. identidade e conta;
2. eventos e task state do CoopCode;
3. descoberta e leases do CoopRouter;
4. ledger e reputação da CoopBruma;
5. storage e sincronização.

Cada substituição mantém contrato, testes e fallback até atingir paridade.

### 5+. Ecossistema CoopCentral

Priorizar apps por capacidade reaproveitável e receita, não por quantidade:
identidade/perfil, comunicação, marketplace e pagamentos antes de superfícies
sociais amplas.

## Regras de portfólio

- `C:\Dev2026\agentic-ide` é o checkout de desenvolvimento do CoopCode.
- `apps/desktop/orca` contém o snapshot ativo da casca Electron.
- `C:\Dev2026\external_repos` contém somente upstreams e fixtures de consulta.
- CoopRouter e CoopBruma terão repositórios e releases próprios.
- CoopCentral Core não entra como dependência do MVP antes da fase 3.
- Toda participação em compute ou storage é opt-in separado.
- Nenhuma promessa de remuneração precede medição verificável e revisão legal.
- A reescrita futura não justifica código descartável inseguro; justifica
  integração simples e contratos estreitos.
