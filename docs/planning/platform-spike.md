# Platform Spike — Backlog Executável

## Objetivo

Provar, na ordem obrigatória de prioridade, que a IDE agêntica pode ser desenvolvida, executada, empacotada e validada com dependências nativas mínimas:

1. Windows 11 ARM64 (`win32-arm64`) — plataforma atual e bloqueadora;
2. Windows 11 x64;
3. Linux ARM64.

O spike cobre somente toolchain, builds nativos, `opencode serve`, integração básica com Orca, módulos nativos, packaging e CI. Não inclui interface final, recursos de produto, conta, sincronização ou suporte a plataformas fora da lista.

## Baseline conhecido

- Host atual: Windows 11 ARM64 (`win32-arm64`).
- Node.js: `22.20.0`.
- Git: `2.51`.
- Bun: `1.3.14`.
- `pnpm`: ausente.
- Orca: `C:\Dev2026\external_repos\orca`.
- OpenCode: `C:\Dev2026\external_repos\opencode`.

## Regras de execução

- Executar tarefas na ordem de dependências e respeitar a prioridade de plataforma.
- Registrar versão, arquitetura, comando, duração, saída resumida e artefatos em cada evidência.
- Todo comando de shell deve ser prefixado por `rtk`.
- Falha em ARM64 bloqueia a promoção da mesma etapa para Windows x64 e Linux ARM64, salvo se a tarefa declarar explicitamente execução independente.
- Preferir ferramentas e configurações já existentes nos repositórios; adicionar dependência somente quando necessária para remover um bloqueio comprovado.

## Backlog

### PLAT-001 — Inventário reproduzível do host ARM64

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** confirmar a linha de base do ambiente e detectar pré-requisitos ausentes.
- **Dependências:** nenhuma.
- **Passos:**
  1. Executar `rtk node --version`, `rtk git --version`, `rtk bun --version` e `rtk pnpm --version`.
  2. Executar `rtk node -p "process.platform + '-' + process.arch"`.
  3. Registrar versões, arquitetura e disponibilidade de gerenciadores de pacote.
- **Critérios de aceitação:** inventário identifica `win32-arm64`, Node `22.20.0`, Git `2.51`, Bun `1.3.14` e a ausência/presença real de `pnpm`.
- **Evidências:** saída dos comandos e um registro datado na documentação de execução do spike.
- **Riscos:** PATH diferente entre terminal, CI e processo de empacotamento.

### PLAT-002 — Fixar a toolchain mínima

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** atender os engines dos upstreams e tornar instalações
  reproduzíveis sem introduzir mais de um fluxo de dependências.
- **Dependências:** PLAT-001.
- **Passos:**
  1. Inspecionar `engines`, `packageManager`, manifests e lockfiles de Orca e
     OpenCode.
  2. Instalar Node 24 ARM64, exigido pelo Orca, sem remover a possibilidade de
     reproduzir o inventário anterior.
  3. Instalar a versão de `pnpm` declarada pelo Orca.
  4. Preservar Bun como runtime/build tool do OpenCode.
  5. Confirmar versões e comandos de instalação reproduzíveis.
- **Critérios de aceitação:** `node`, `pnpm` e `bun` reportam versões e
  arquitetura compatíveis; cada upstream possui um único comando de instalação
  documentado, sem conversão de lockfile.
- **Evidências:** engines e lockfiles encontrados, versões finais da toolchain e
  saída dos comandos de verificação.
- **Riscos:** divergência entre Bun, npm e pnpm pode alterar resolução de dependências ou binários opcionais.

### PLAT-003 — Checkout e instalação limpa do OpenCode

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** provar que `C:\Dev2026\external_repos\opencode` instala dependências no host alvo.
- **Dependências:** PLAT-002.
- **Passos:**
  1. Confirmar revisão Git usada.
  2. Executar o comando de instalação definido em PLAT-002 no diretório do OpenCode.
  3. Reexecutar o comando sem alterar arquivos para verificar idempotência.
- **Critérios de aceitação:** instalação termina com sucesso e não produz alteração inesperada de manifests ou lockfiles.
- **Evidências:** hash do commit, saída resumida e `rtk git status` antes/depois.
- **Riscos:** pacotes opcionais podem não publicar binário `win32-arm64`.

### PLAT-004 — Build nativo do OpenCode em Windows ARM64

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** executar o build oficial do OpenCode e validar todos os artefatos nativos requeridos pelo build.
- **Dependências:** PLAT-003.
- **Passos:**
  1. Identificar o script oficial de build no manifest do OpenCode.
  2. Executá-lo com `rtk`.
  3. Classificar falhas por toolchain, arquitetura, dependência nativa ou script.
- **Critérios de aceitação:** build conclui sem emulação x64 implícita; se houver artefato nativo, sua arquitetura é ARM64.
- **Evidências:** comando, log resumido, caminho e metadados dos artefatos gerados.
- **Riscos:** compiladores MSVC/Windows SDK ausentes, `node-gyp`, Rust ou binários pré-compilados indisponíveis.

### PLAT-005 — Smoke test de `opencode serve`

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** provar que o servidor do OpenCode inicia, responde localmente e encerra de forma controlada.
- **Dependências:** PLAT-004.
- **Passos:**
  1. Descobrir a sintaxe oficial de `opencode serve` no checkout validado.
  2. Iniciar o processo com porta local explícita.
  3. Consultar endpoint de saúde, status ou resposta HTTP equivalente documentada.
  4. Encerrar o processo e confirmar liberação da porta.
- **Critérios de aceitação:** processo inicia sem erro de arquitetura, uma requisição local recebe resposta válida e o encerramento não deixa processo órfão.
- **Evidências:** PID, porta, requisição/resposta sanitizada e código de saída.
- **Riscos:** comandos ou endpoints podem variar conforme a revisão; portas ocupadas e firewall local podem gerar falso negativo.

### PLAT-006 — Checkout, instalação e build mínimo do Orca

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** validar que `C:\Dev2026\external_repos\orca` executa seu caminho de build mínimo no host alvo.
- **Dependências:** PLAT-002.
- **Passos:**
  1. Confirmar revisão e instruções de build do Orca.
  2. Instalar dependências com o gerenciador prescrito.
  3. Executar o menor build/lint/typecheck oficial capaz de carregar os módulos necessários.
- **Critérios de aceitação:** o caminho mínimo conclui no ARM64 e qualquer falha restante é reproduzível e classificada.
- **Evidências:** hash do commit, comando executado, saída resumida e artefatos quando aplicável.
- **Riscos:** requisito de runtime ou SDK não documentado e dependência transitiva sem suporte ARM64.

### PLAT-007 — Integração mínima Orca → OpenCode

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** provar o caminho de integração realmente implementado entre
  Orca e OpenCode, sem construir UX final.
- **Dependências:** PLAT-005, PLAT-006.
- **Passos:**
  1. Confirmar se a integração usa HTTP, processo supervisionado, PTY ou
     armazenamento compartilhado.
  2. Tornar o binário ARM64 validado resolvível pelo comando que o Orca
     realmente executa.
  3. Exercitar, sem enviar prompt a modelo, a detecção, o plano de lançamento,
     a injeção do plugin e a entrega de evento por loopback.
  4. Registrar binário resolvido, request/response local e encerramento.
- **Critérios de aceitação:** Orca resolve o OpenCode ARM64 validado, seu
  contrato de lançamento é aprovado e o plugin entrega eventos ao hook local
  sem erro de protocolo, arquitetura ou processo filho.
- **Evidências:** PATH efetivo, versão do binário, testes dirigidos do PTY/plugin
  e procedimento visual sem consumo de modelo.
- **Riscos:** outro `opencode` no PATH, mudanças no contrato de plugins e
  criação de configuração/cache local pelo TUI.

### PLAT-008 — Auditoria de módulos nativos e estratégia de fallback

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** mapear apenas módulos nativos presentes no caminho validado e decidir a menor correção por bloqueio.
- **Dependências:** PLAT-004, PLAT-006, PLAT-007.
- **Passos:**
  1. Inspecionar árvores de dependência e logs por binários `.node`, `node-gyp`, N-API, Rust, Go ou pré-builds.
  2. Para cada módulo, registrar suporte ARM64, origem do binário e se é necessário para o smoke test.
  3. Definir fallback mínimo: versão suportada, build local ou desabilitação do recurso não essencial.
- **Critérios de aceitação:** nenhum módulo nativo necessário fica sem dono, status e caminho de resolução.
- **Evidências:** tabela de módulos com versão, arquitetura, necessidade e decisão.
- **Riscos:** dependências opcionais são carregadas apenas em runtime e escapam à inspeção estática.

### PLAT-009 — Packaging mínimo em Windows ARM64

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** gerar e executar um artefato instalável ou portátil mínimo da IDE/integrador, usando a configuração existente.
- **Dependências:** PLAT-007, PLAT-008.
- **Passos:**
  1. Identificar o mecanismo de packaging já adotado pelo projeto.
  2. Executar o target Windows ARM64 sem adicionar distribuição multi-plataforma.
  3. Instalar/executar em ambiente local e repetir o smoke test de conexão.
- **Critérios de aceitação:** artefato é identificado como ARM64, inicia no Windows ARM64 e completa o smoke test local.
- **Evidências:** nome, hash, tamanho e metadados do artefato; log de execução pós-empacotamento.
- **Riscos:** empacotador não suporta ARM64, assinaturas/certificados indisponíveis ou dependências externas omitidas.

### PLAT-010 — CI ARM64 mínima e reprodutível

- **Prioridade:** P0 — Windows 11 ARM64.
- **Objetivo:** automatizar somente as provas já bem-sucedidas no host prioritário.
- **Dependências:** PLAT-009.
- **Passos:**
  1. Verificar disponibilidade de runner Windows ARM64 compatível com o provedor de CI escolhido.
  2. Criar proposta de pipeline com checkout, instalação, build, `opencode serve` smoke test e retenção de logs/artefato.
  3. Executar uma rodada manual ou de branch antes de torná-la obrigatória.
- **Critérios de aceitação:** pipeline usa arquitetura ARM64 declarada, falha com diagnóstico acionável e publica logs/artefato do spike.
- **Evidências:** link/ID da execução, definição do runner e artefatos anexados.
- **Riscos:** runners ARM64 hospedados indisponíveis ou custo/limites de minutos; exigir emulação invalida a prova.

### PLAT-011 — Repetição dirigida em Windows 11 x64

- **Prioridade:** P1 — Windows 11 x64.
- **Objetivo:** repetir as provas aprovadas para ARM64 na plataforma secundária, sem expandir escopo.
- **Dependências:** PLAT-010.
- **Passos:**
  1. Provisionar host/runner Windows 11 x64 limpo.
  2. Reexecutar PLAT-001, PLAT-003 a PLAT-009 com versões equivalentes.
  3. Comparar diferenças de módulos nativos, artefatos e comportamento do smoke test.
- **Critérios de aceitação:** build, servidor, integração e packaging passam em x64; divergências possuem registro e decisão mínima.
- **Evidências:** matriz comparativa ARM64/x64, logs e artefato x64.
- **Riscos:** sucesso em x64 pode esconder regressão específica de ARM64; não usar x64 como substituto da prioridade P0.

### PLAT-012 — Repetição dirigida em Linux ARM64

- **Prioridade:** P2 — Linux ARM64.
- **Objetivo:** validar o mesmo caminho mínimo em Linux ARM64 após estabilidade nas duas plataformas Windows.
- **Dependências:** PLAT-011.
- **Passos:**
  1. Provisionar host/runner Linux ARM64 limpo e registrar distribuição/versão.
  2. Reexecutar instalação, build, `opencode serve`, integração e packaging aplicáveis.
  3. Registrar dependências de sistema estritamente necessárias.
- **Critérios de aceitação:** o caminho mínimo executa nativamente em Linux ARM64 ou há bloqueio reproduzível com dono e próxima ação definida.
- **Evidências:** inventário do host, logs, matriz de módulos e artefato aplicável.
- **Riscos:** bibliotecas de sistema, glibc/musl e formato de distribuição podem divergir; não iniciar suporte a outras distros sem evidência de necessidade.

### PLAT-013 — Gate de decisão do spike

- **Prioridade:** P0/P1/P2 conforme plataforma avaliada.
- **Objetivo:** transformar evidências em decisão objetiva de continuidade.
- **Dependências:** PLAT-010; PLAT-011 e PLAT-012 quando as respectivas plataformas estiverem no escopo da rodada.
- **Passos:**
  1. Consolidar a matriz por plataforma: toolchain, build, servidor, Orca, módulos nativos, packaging e CI.
  2. Classificar cada item como aprovado, bloqueado ou não aplicável.
  3. Abrir apenas os bloqueios que impedem a próxima prioridade; adiar melhorias sem impacto na prova.
- **Critérios de aceitação:** há decisão Go/No-Go explícita para Windows ARM64 e, posteriormente, para cada plataforma secundária.
- **Evidências:** matriz final, lista curta de bloqueios priorizados e registro da decisão.
- **Riscos:** aceitar sucesso parcial sem packaging/CI ou ampliar o spike para funcionalidades de IDE antes de fechar a prova de plataforma.

## Fora de escopo (YAGNI)

- Implementar recursos de editor, chat, agentes, autenticação, telemetria ou sincronização.
- Projetar arquitetura definitiva de plugins, extensões ou múltiplos provedores.
- Suportar macOS, Linux x64, Windows anteriores ou distribuição universal.
- Assinatura de produção, publicação em lojas e atualização automática, exceto se indispensáveis para executar PLAT-009.
- Otimização de desempenho, hardening e testes end-to-end além dos smoke tests definidos.
