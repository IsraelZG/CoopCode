# Evidência PLAT-001

- Data: 2026-07-28
- Host: Windows 11
- Plataforma Node: `win32`
- Arquitetura Node: `arm64`

## Inventário

| Ferramenta | Resultado |
|---|---|
| Node.js | `v22.20.0` |
| Git | `2.51.0.windows.2` |
| Bun | `1.3.14` |
| pnpm | não encontrado no `PATH` |

## Comandos executados

```text
rtk node -p "process.platform + '-' + process.arch + ' node-' + process.version"
rtk git --version
rtk pnpm --version
rtk bun --version
```

## Conclusão

O host prioritário é ARM64 nativo. `PLAT-002` deve instalar Node 24 ARM64 e a
versão de pnpm declarada pelo Orca, preservando Bun para o build do OpenCode.
