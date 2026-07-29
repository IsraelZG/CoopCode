# Evidência PLAT-007

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Orca: `0404f27b3f82e4934500ce1029d3d0875f471114`
- OpenCode: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Resultado: concluído

## Arquitetura real da integração

A hipótese inicial de cliente Orca → `opencode serve` não corresponde ao código
desta revisão. O caminho implementado é:

```text
Orca agent catalog
  → comando `opencode`
  → PTY supervisionado
  → OPENCODE_CONFIG_DIR com plugin Orca
  → POST loopback para /hook/opencode
  → estado da sessão no Orca
```

Evidências no Orca:

- `TUI_AGENT_CONFIG.opencode` define `detectCmd`, `launchCmd` e
  `expectedProcess` como `opencode`;
- o plano de retomada usa `opencode --session <id>`;
- `OpenCodeHookService.buildPtyEnv` injeta um `OPENCODE_CONFIG_DIR`;
- o plugin `orca-opencode-status.js` envia eventos ao servidor local de hooks;
- o scanner SQLite apenas lê sessões persistidas e não é o caminho de execução.

O OpenCode oferece `serve`, mas o Orca não contém cliente HTTP para esse
servidor nesta revisão.

## Resolução do binário ARM64

Durante o gate, existia outro OpenCode global `1.15.13` no host. Foi criado
`tools\orca-opencode-arm64.cmd` para colocar o build validado primeiro no
`PATH` antes de iniciar o Orca. Após o gate, a instalação global antiga foi
removida pelo npm a pedido do usuário; o launcher permanece como garantia
explícita de resolução.

Comando:

```text
rtk tools\orca-opencode-arm64.cmd --check
```

Resultado:

```text
C:\Dev2026\external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe
0.0.0-dev-202607281756
```

O primeiro executável resolvido é o PE ARM64 `0xAA64` aprovado em `PLAT-004`.
O check não iniciou sessão e não enviou prompt.

## Testes dirigidos

### Plugin e entrega local

```text
rtk C:\Dev2026\agentic-ide\tools\node-arm64.cmd node_modules\vitest\vitest.mjs run src\main\opencode\hook-service.test.ts src\main\opencode\hook-plugin-lifecycle-delivery.test.ts
```

Resultado:

```text
Test Files  2 passed (2)
Tests       52 passed | 3 skipped (55)
Duration    2.61s
```

Esses testes exercitam criação/overlay de `OPENCODE_CONFIG_DIR`, instalação do
plugin, ciclo de vida e entrega HTTP local de eventos.

### Detecção e lançamento da TUI

```text
rtk C:\Dev2026\agentic-ide\tools\node-arm64.cmd node_modules\vitest\vitest.mjs run src\shared\tui-agent-startup.test.ts src\main\ipc\tui-agent-detection-commands.test.ts
```

Resultado:

```text
Test Files  2 passed (2)
Tests       67 passed (67)
Duration    1.04s
```

Total do gate: 119 testes aprovados e 3 ignorados pelo próprio upstream.
Nenhum prompt foi enviado e nenhum modelo foi chamado.

## Interfaces do OpenCode

O binário ARM64 confirmou:

- `opencode [project]`: TUI, comando padrão;
- `opencode serve`: servidor headless;
- `opencode web`: servidor com interface web no navegador;
- `opencode attach <url>`: TUI ligada a servidor existente.

## Integridade

- Checkout Orca: `git status --short` vazio.
- Checkout OpenCode: `git status --short` vazio.
- Nenhum manifesto ou lockfile upstream foi alterado.

## Como verificar hands-on

Na raiz `C:\Dev2026\agentic-ide`:

```text
rtk tools\orca-opencode-arm64.cmd --check
```

O primeiro caminho deve terminar em
`opencode-windows-arm64\bin\opencode.exe`, seguido da versão
`0.0.0-dev-202607281756`.

Para a prova visual, sem consumir modelo:

```text
rtk tools\orca-opencode-arm64.cmd
```

Na interface:

1. crie uma aba ou terminal com o agente **OpenCode**;
2. aguarde a TUI aparecer;
3. não envie mensagem;
4. pressione `Ctrl+C` para encerrá-la.

Sucesso é a TUI OpenCode aparecer dentro do terminal Orca e encerrar sem deixar
o agente ativo. Abrir a TUI pode criar cache/configuração local, mas sem prompt
não há chamada a modelo.

## Conclusão

O Orca resolve e supervisiona o OpenCode ARM64 pelo caminho PTY/plugin realmente
implementado. `opencode serve` permanece disponível para a arquitetura futura,
mas não deve ser apresentado como integração existente do Orca. `PLAT-008` pode
auditar os módulos e assets nativos restantes.
