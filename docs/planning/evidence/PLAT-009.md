# Evidência PLAT-009

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Orca base: `0404f27b3f82e4934500ce1029d3d0875f471114`
- Electron Builder: 26.15.3
- Electron: 43.1.0
- Resultado: concluído

## Correção mínima

O pipeline existente já propagava `--arm64` para o rebuild de `node-pty` e
`windows-native-registry`. Duas entradas de `extraResources`, porém, estavam
fixadas em x64:

- `sherpa-onnx-win-x64`;
- `agent-browser-win32-x64.exe`.

Os caminhos foram alterados para usar o macro `${arch}` do próprio Electron
Builder. No target ARM64, os dois recursos inexistentes são omitidos; no target
x64, os caminhos continuam resolvendo para os mesmos arquivos anteriores.

Arquivos alterados no Orca:

- `config/electron-builder.config.cjs`;
- `src/main/cli/packaged-cli-assets.test.ts`.

O OpenCode não é incluído no pacote Orca nesta etapa. A integração continua
resolvendo o executável ARM64 externo pelo `PATH`. O launcher
`tools\orca-opencode-arm64.cmd` ganhou a opção `--packaged` para iniciar o
pacote com esse caminho já injetado.

## Build

Comando executado:

```text
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run build:win -- --arm64 --dir
```

O pipeline executou typecheck, builds de relay/CLI/Electron/web, validação do
runtime Electron, rebuild nativo `win32-arm64`, packaging portátil e NSIS.

Marcos registrados pelo empacotador:

```text
packaging platform=win32 arch=arm64 electron=43.1.0
appOutDir=dist\win-arm64-unpacked
[verify-packaged-daemon-entry] OK
[verify-packaged-plugin-resources] OK
building target=nsis archs=arm64
```

Os avisos de CSS e imports dinâmicos já existentes não bloquearam o build.

## Artefatos

| Artefato | Tamanho | SHA-256 | Metadados |
| --- | ---: | --- | --- |
| `dist\win-arm64-unpacked\Orca.exe` | 205.522.432 bytes | `c327e758d1b3c27458a157a51d4217e09d6e4585ed5d5fbfd6bca55a64fc4489` | PE `0xAA64`, FileVersion `1.4.160-rc.3` |
| `dist\orca-windows-setup.exe` | 173.689.106 bytes | `ddad0e129143b82546900ad968472f963c13b6dde5c9b39888db48c66d8a5c9d` | NSIS com payload `archs=arm64` |

O launcher CLI empacotado é um assembly gerenciado `MSIL`, não um PE x64, e
executou corretamente no host ARM64.

## Gate de arquitetura

Comando:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-orca-package-arm64.ps1
```

Resultado:

```text
Package ARM64 checks: 12 passed, 0 failed
```

Foram comprovados como ARM64:

- `Orca.exe`;
- `node-pty`: `pty.node`, `conpty.node`, console list, `OpenConsole.exe` e
  `conpty.dll`;
- Parcel watcher;
- Windows native registry.

O gate também confirmou que o helper `agent-browser` x64 e o payload
`sherpa-onnx` x64 não foram copiados.

O pacote ainda carrega prebuilds inativos x64 do próprio `node-pty`, pois o
pruner upstream preserva todas as arquiteturas da plataforma Windows. Os
addons selecionados em `build\Release` são ARM64; remover os prebuilds
inativos seria apenas uma otimização de tamanho e ficou fora deste spike.

## Testes

### Contratos do empacotador

```text
Test Files  4 passed (4)
Tests       32 passed | 5 skipped (37)
```

Foram executados os testes do config Electron Builder, rebuild nativo,
launcher Windows e assets do CLI empacotado.

### CLI fora do repositório

O smoke test existente copiou o app para um diretório temporário e executou:

```text
resources\bin\orca.exe --help
```

Resultado:

```text
[packaged-cli-smoke] ...\resources\bin\orca.exe --help succeeded outside the repo
```

### Runtime empacotado

O `Orca.exe` portátil foi iniciado. O CLI empacotado respondeu:

```json
{
  "app": {
    "running": true,
    "desktopWindowStatus": "available"
  },
  "runtime": {
    "state": "ready",
    "reachable": true,
    "appVersion": "1.4.160-rc.3"
  },
  "graph": {
    "state": "ready"
  }
}
```

O processo abriu a janela `Orca`; nenhum prompt foi enviado e nenhum modelo foi
chamado. Os PIDs criados pelo smoke foram encerrados ao final.

## Limitações deliberadas do primeiro pacote ARM64

- automação avançada que exige o helper externo `agent-browser` fica
  indisponível;
- ditado offline com `sherpa-onnx` fica indisponível;
- OpenCode permanece um executável externo, resolvido por `PATH`;
- o instalador não foi aplicado ao perfil do usuário, porque o pacote portátil
  já satisfaz o teste de execução sem alterar a instalação do host.

## Como verificar hands-on

Na raiz `C:\Dev2026\agentic-ide`:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-orca-package-arm64.ps1
rtk tools\orca-opencode-arm64.cmd --check
rtk tools\orca-opencode-arm64.cmd --packaged
```

Os dois primeiros comandos devem terminar com `12 passed, 0 failed` e mostrar
o `opencode.exe` compilado seguido da versão `0.0.0-dev-202607281756`.

No Orca empacotado:

1. confirme que a janela abriu;
2. crie uma aba/terminal com o agente **OpenCode**;
3. aguarde a TUI aparecer, sem enviar mensagem;
4. pressione `Ctrl+C` para encerrá-la.

Sucesso é a TUI OpenCode aparecer dentro do terminal do Orca empacotado. Sem
prompt, esse procedimento não chama modelo.

## Conclusão

O pacote portátil e o instalador Windows ARM64 foram gerados. O executável
principal, os addons ativos, o CLI e o runtime foram validados localmente.
`PLAT-010` pode automatizar exatamente estes gates em CI.
