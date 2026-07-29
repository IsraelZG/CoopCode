# Evidência PLAT-002

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Resultado: concluído

## Requisitos confirmados

| Upstream | Requisito |
|---|---|
| Orca | Node `24` |
| Orca | `pnpm@10.24.0` |
| OpenCode | `bun@1.3.14` |

O Orca declara suporte de instalação para `win32` e `arm64` no campo
`pnpm.supportedArchitectures`. O OpenCode usa `bun.lock` e seu build principal é
executado por Bun.

## Toolchain fixada

| Ferramenta | Plataforma | Versão | Invocação |
|---|---|---|---|
| Node.js | `win32-arm64` | `v24.18.0` | `rtk tools\node-arm64.cmd` |
| pnpm | Node ARM64 local | `10.24.0` | `rtk tools\pnpm-arm64.cmd` |
| Bun | `win32-arm64` | `1.3.14` | `rtk bun` |

Node e pnpm foram instalados em `.toolchains/`, ignorado pelo Git. A instalação
global de Node 22 não foi substituída.

## Integridade do Node

- Origem:
  `https://nodejs.org/dist/v24.18.0/node-v24.18.0-win-arm64.zip`
- SHA-256 calculado:
  `f274669adb93b1fd0fbf8f21fd078609e9dcc84333d4f2718d2dde3f9a161a01`
- SHA-256 publicado em `SHASUMS256.txt`:
  `f274669adb93b1fd0fbf8f21fd078609e9dcc84333d4f2718d2dde3f9a161a01`

## Validação

```text
rtk tools\node-arm64.cmd -p "process.platform + '-' + process.arch + ' ' + process.version"
win32-arm64 v24.18.0

rtk tools\pnpm-arm64.cmd --version
10.24.0

rtk bun -e "console.log(process.platform + '-' + process.arch + ' ' + Bun.version)"
win32-arm64 1.3.14
```

## Decisão

Os builds do Platform Spike usarão os wrappers locais, evitando dependência do
`PATH` e alterações na instalação global. `PLAT-003` pode iniciar a instalação
limpa do OpenCode.
