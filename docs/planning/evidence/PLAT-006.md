# Evidência PLAT-006

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Checkout: `C:\Dev2026\external_repos\orca`
- Commit: `0404f27b3f82e4934500ce1029d3d0875f471114`
- Orca: `1.4.160-rc.3`
- Resultado: concluído

## Estado inicial e toolchain

- Worktree Git limpo.
- `node_modules` ausente.
- `pnpm-lock.yaml` presente, lockfile `9.0`.
- Engine: Node `24`.
- Package manager: pnpm `10.24.0`.
- Toolchain validada: Node `24.18.0`, `win32-arm64`; pnpm `10.24.0`.

## Instalação congelada

Comando:

```text
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd install --frozen-lockfile
```

Resultado inicial:

- 1.244 pacotes instalados;
- lockfile aceito sem nova resolução;
- `node-pty` selecionou `win10-arm64`;
- `cpu-features` compilou com MSBuild ARM64;
- Electron `43.1.0` foi materializado;
- postinstall verificou/reconstruiu módulos Electron;
- duração: `3m 31.7s`.

## Correção da propagação do runtime

O primeiro log de `node-gyp` revelou que scripts filhos encontravam o Node
global `22.20.0`, embora o processo pnpm tivesse sido iniciado pelo Node 24.

Os wrappers `tools\node-arm64.cmd` e `tools\pnpm-arm64.cmd` passaram a colocar
o Node local no início do `PATH`. Validação:

```json
{"version":"v24.18.0","arch":"arm64"}
```

`cpu-features` foi recompilado após a correção:

```text
node-gyp 12.3.0
node 24.18.0 | win32 | arm64
MSBuild Platform=ARM64
gyp info ok
```

O postinstall oficial foi repetido e confirmou:

```text
Native modules already load in Electron; skipping rebuild.
```

Uma segunda instalação congelada concluiu em `7.3s`, com `Already up to date`.

## Typecheck

Comando:

```text
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run typecheck
```

Os três projetos TypeScript concluíram com exit code `0`:

- `config/tsconfig.node.json`;
- `config/tsconfig.tc.cli.json`;
- `config/tsconfig.tc.web.json`.

## Build mínimo do aplicativo

Comando:

```text
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run build:electron-vite
```

Resultado:

- main: 1.921 módulos, `6.60s`;
- preload: 15 módulos, `431ms`;
- renderer: 9.111 módulos, `42.04s`;
- exit code `0`.

Artefatos principais:

| Artefato | Tamanho |
|---|---:|
| `out\main\index.js` | 8.048.431 bytes |
| `out\preload\index.js` | 122.336 bytes |
| `out\renderer\index.html` | 26.181 bytes |
| `node_modules\electron\dist\electron.exe` | 205.500.928 bytes |

SHA-256 de `out\main\index.js`:

```text
6dd81d18dc39a205f2c53a4fd5c66c104a435706b662e370c716156b5827ded0
```

## Evidências nativas ARM64

Os cabeçalhos PE abaixo possuem `Machine: 0xAA64`:

| Componente | Tamanho |
|---|---:|
| Electron `electron.exe` | 205.500.928 bytes |
| `cpu-features` | 162.816 bytes |
| `windows-native-registry` | 132.096 bytes |
| Parcel watcher | 557.056 bytes |
| `node-pty` | 293.376 bytes |

`cpu-features` também foi carregado pelo Node 24 ARM64:

```text
cpu-features: PASS v24.18.0 arm64
```

## Avisos e risco remanescente

- Os avisos do bundle tratam de imports mistos e duas regras CSS
  `::highlight`; não interromperam o build.
- `sherpa-onnx` não publica pacote Windows ARM64 nesta revisão; existe somente
  `sherpa-onnx-win-x64`. O recurso é opcional e não foi carregado pelo caminho
  mínimo. Ele permanece para decisão em `PLAT-008`.
- `build:cli` foi evitado porque instala um link de desenvolvimento fora do
  checkout. O launcher C# e o packaging completo pertencem aos gates
  posteriores.

## Integridade do checkout

- `git status --short`: vazio.
- `git diff --exit-code -- package.json pnpm-lock.yaml`: sucesso.
- Manifests e lockfile não foram alterados.

## Como verificar hands-on

Em `C:\Dev2026\external_repos\orca`:

```text
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd exec node -e "console.log(process.version, process.platform, process.arch)"
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd install --frozen-lockfile
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run typecheck
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run build:electron-vite
```

Sucesso exige:

- primeiro comando: `v24.18.0 win32 arm64`;
- instalação: `Already up to date` e exit code `0`;
- typecheck: exit code `0`, sem erros TypeScript;
- build: três mensagens `built` e os arquivos
  `out\main\index.js`, `out\preload\index.js` e
  `out\renderer\index.html`.

## Smoke visual

O usuário executou o preview Electron com:

```text
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd start
```

Em 2026-07-28, confirmou que a interface desktop do Orca abriu com sucesso no
host Windows 11 ARM64.

## Conclusão

O Orca instala, valida tipos e gera seu bundle Electron mínimo em Windows
ARM64 com runtime e módulos nativos ARM64. `PLAT-007` pode provar a integração
local Orca → OpenCode.
