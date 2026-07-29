# Evidência PLAT-003

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Checkout: `C:\Dev2026\external_repos\opencode`
- Commit: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Runtime: Bun `1.3.14`, `win32-arm64`
- Resultado: concluído

## Estado inicial

- Worktree Git limpo.
- `node_modules` ausente.
- `bun.lock` presente, `lockfileVersion: 1`.
- `packageManager`: `bun@1.3.14`.

## Comando

```text
rtk bun install --frozen-lockfile
```

## Bloqueio encontrado

A primeira execução materializou as dependências, mas
`tree-sitter-powershell@0.25.10` precisou compilar um addon ARM64. O
`node-gyp` encontrou apenas Visual Studio Build Tools 2019 sem o toolset v142
ARM64 e encerrou com `MSB8020`.

Não foram usados `--ignore-scripts`, emulação x64 ou alteração do lockfile.

## Correção

Foi instalado o Visual Studio Build Tools 2022 com:

- workload `Microsoft.VisualStudio.Workload.VCTools`;
- componente `Microsoft.VisualStudio.Component.VC.Tools.ARM64`;
- componentes recomendados, incluindo Windows SDK.

Validação via `vswhere`:

```text
Visual Studio Build Tools 2022
17.14.37516.0
Microsoft.VisualStudio.Component.VC.Tools.ARM64 presente
isComplete: true
isRebootRequired: false
```

O bootstrapper utilizado possuía assinatura Authenticode válida da Microsoft
Corporation.

## Instalação validada

Após a correção:

```text
Checked 2394 installs across 2692 packages (no changes) [8.55s]
```

Segunda execução, para idempotência:

```text
Checked 2394 installs across 2692 packages (no changes) [2.27s]
```

O postinstall `bun run --cwd packages/core fix-node-pty` concluiu nas duas
execuções.

## Evidências ARM64

Entre os pacotes materializados:

- `@lydell/node-pty-win32-arm64`;
- `@parcel/watcher-win32-arm64`;
- `@opentui/core-win32-arm64`;
- `@ff-labs/fff-bin-win32-arm64`;
- `@esbuild/win32-arm64`;
- bindings OXC e Rollup `win32-arm64`.

## Integridade do checkout

- `git status --short`: vazio.
- `git diff --exit-code -- bun.lock package.json`: sucesso.
- Manifests e lockfile não foram alterados.

## Conclusão

O OpenCode possui instalação congelada e idempotente em Windows ARM64.
`PLAT-004` pode executar o build nativo oficial.
