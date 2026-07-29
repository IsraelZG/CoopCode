# Evidência PLAT-008

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Orca: `0404f27b3f82e4934500ce1029d3d0875f471114`
- OpenCode: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Resultado: concluído com quatro lacunas conhecidas e encaminhadas

## Escopo

A auditoria considera os módulos nativos do caminho já validado e os assets que
podem bloquear o packaging Windows ARM64. Dependências exclusivas de lint,
documentação, testes ou builds para outras plataformas foram excluídas.

O gate automatizado lê o campo `Machine` do cabeçalho PE. O valor esperado para
ARM64 é `0xAA64`; `0x8664` identifica x64.

## Matriz OpenCode

| Componente | Versão | Origem | Necessidade | ARM64 | Decisão |
| --- | --- | --- | --- | --- | --- |
| `opencode.exe` | build dev | build Bun | núcleo da integração | `0xAA64` | aprovado |
| OpenTUI | 0.4.5 | prebuild | TUI | `0xAA64` | aprovado |
| FFF | 0.9.4 | prebuild | busca de arquivos | `0xAA64` | aprovado |
| Parcel watcher | 2.5.1 | prebuild opcional | watch de arquivos | `0xAA64` | aprovado |
| `@lydell/node-pty` | 1.2.0-beta.12 | prebuild | PTY do desktop OpenCode | `0xAA64` nos quatro assets ConPTY | disponível, mas não usado na integração Orca |
| `bun-pty` | 0.4.8 | DLL embarcada | endpoint PTY interno do servidor | `0x8664` | não usar o PTY interno no MVP ARM64; o Orca continua dono do PTY |
| tree-sitter Bash/PowerShell | 0.25.x | WASM | parsing de comandos | sem PE no runtime | aprovado como WASM |

O `bun-pty` é carregado de forma tardia quando uma sessão PTY interna é criada.
Ele não participa de `opencode --version`, do TUI hospedado pelo Orca nem do
health check de `opencode serve`. Se o endpoint PTY do OpenCode se tornar
necessário, será preciso compilar essa DLL para ARM64 ou trocar a implementação.

`sharp`, `msgpackr-extract`, esbuild, OXC, Rollup, 7zip, SST e assets de
documentação encontrados na árvore não pertencem ao runtime validado e não
entram no artefato mínimo.

## Matriz Orca

| Componente | Versão | Origem | Necessidade | ARM64 | Decisão |
| --- | --- | --- | --- | --- | --- |
| Electron | 43.1.0 | distribuição oficial | núcleo da interface | `0xAA64` | aprovado |
| `node-pty` | 1.1.0 + patch Orca | prebuild ARM64; rebuild no packaging | núcleo do terminal e agentes | `0xAA64` em `pty.node` e quatro assets ConPTY | aprovado; PLAT-009 deve repetir o rebuild Electron |
| Parcel watcher | 2.5.6 | prebuild opcional | watch de arquivos | `0xAA64` | aprovado |
| Windows native registry | 3.2.2 | build local | integração Windows/CLI | `0xAA64` | aprovado |
| `cpu-features` | 0.0.10 | build local | otimização opcional do SSH | `0xAA64` | não bloquear; o `ssh2` possui fallback JS |
| `agent-browser` | 0.27.x | executável distribuído | automação avançada do browser | somente `0x8664` | excluir o helper no pacote ARM64 mínimo e manter a lacuna explícita |
| `sherpa-onnx` | 1.12.37 | pacote por plataforma | ditado offline | não publica Windows ARM64 | desabilitar ditado offline em Windows ARM64 |
| Windows CLI launcher | fonte C# | build nativo do Orca | pacote Windows | ainda não gerado | PLAT-009 deve compilar e exigir `0xAA64` |

O browser embutido e sua visualização são Electron. A lacuna do
`agent-browser` afeta os comandos avançados que dependem do helper externo, não
a abertura da interface. Não será usada emulação x64 como prova de ARM64.

## Resultado do gate PE

Comando:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-native-arm64.ps1
```

Resumo:

```text
Required ARM64 checks: 12 passed, 0 failed
Known gaps: 4
```

Além dos 12 itens obrigatórios, cinco assets opcionais também foram confirmados
como ARM64. As quatro lacunas são `bun-pty`, `agent-browser`, `sherpa-onnx` e o
launcher Windows ainda não construído.

## Propriedade das lacunas

| Lacuna | Impacto no MVP atual | Dono / resolução |
| --- | --- | --- |
| OpenCode `bun-pty` x64 | nenhum no TUI hospedado pelo Orca | arquitetura: Orca permanece dono do PTY; reavaliar somente se adotarmos o endpoint PTY do OpenCode |
| `agent-browser` x64 | automação avançada indisponível no primeiro pacote ARM64 | PLAT-009: condicionar/excluir asset; tarefa futura para helper ARM64 |
| `sherpa-onnx` sem Windows ARM64 | ditado offline indisponível | PLAT-009: excluir/feature-gate em ARM64 |
| launcher Windows ausente | bloqueia o pacote, não o app em modo dev | PLAT-009: executar build nativo e validar `0xAA64` |

## Integridade

- Checkout Orca: `git status --short` vazio.
- Checkout OpenCode: `git status --short` vazio.
- Nenhum manifesto, lockfile ou fonte upstream foi alterado.

## Como verificar hands-on

Na raiz `C:\Dev2026\agentic-ide`:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-native-arm64.ps1
```

Sucesso termina com:

```text
Required ARM64 checks: 12 passed, 0 failed
Known gaps: 4
```

Linhas `[PASS]` comprovam `0xAA64`. Linhas `[GAP ]` são decisões registradas e
não fazem o gate falhar. Uma linha `[FAIL]` ou código de saída diferente de zero
indica regressão em um componente obrigatório.

## Conclusão

Nenhum módulo nativo necessário ao caminho Orca → PTY → OpenCode TUI ficou sem
status, responsável ou resolução. A PLAT-009 pode iniciar o packaging mínimo,
tratando explicitamente os três recursos x64/ausentes e produzindo o launcher
Windows ARM64.
