# Toolchain local

No Windows ARM64, use:

```text
rtk tools\node-arm64.cmd <argumentos>
rtk tools\pnpm-arm64.cmd <argumentos>
rtk cmd /c tools\bun-arm64.cmd <argumentos>
```

Os wrappers mantêm Node 24 e pnpm fixados sem alterar a instalação global. Os
binários ficam em `.toolchains/`, ignorado pelo Git. O wrapper do Bun também
seleciona o Visual Studio Build Tools 2022 para addons nativos ARM64.
Os wrappers de Node e pnpm colocam o Node 24 no início do `PATH`, garantindo
que scripts filhos e `node-gyp` usem a mesma versão.

## Verificações hands-on

Depois de compilar o OpenCode ARM64, execute:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-opencode-serve-arm64.ps1
```

O script usa somente recursos nativos do PowerShell para iniciar
`opencode serve`, consultar `/global/health`, encerrar o processo e confirmar
que a porta foi liberada.

Para repetir o gate mínimo do Orca:

```text
cd C:\Dev2026\external_repos\orca
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd install --frozen-lockfile
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run typecheck
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run build:electron-vite
```

Sucesso gera `out\main\index.js`, `out\preload\index.js` e
`out\renderer\index.html`.

Para abrir o Orca garantindo que ele encontre o OpenCode ARM64 compilado:

```text
rtk tools\orca-opencode-arm64.cmd --check
rtk tools\orca-opencode-arm64.cmd
```

`--check` mostra o executável e a versão que serão herdados pelo Orca sem abrir
a interface.

Para repetir a auditoria dos binários nativos Windows ARM64:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-native-arm64.ps1
```

O gate lê o cabeçalho PE dos componentes obrigatórios. Sucesso termina com
zero falhas. Lacunas conhecidas de recursos opcionais aparecem como `[GAP ]`
e estão documentadas em `docs/planning/evidence/PLAT-008.md`.

Para gerar o pacote Orca Windows ARM64 completo:

```text
cd C:\Dev2026\external_repos\orca
rtk C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run build:win -- --arm64
```

O comando gera `dist\win-arm64-unpacked` e
`dist\orca-windows-setup.exe`. Para auditar arquitetura, módulos ativos,
helpers x64 e hashes:

```text
cd C:\Dev2026\agentic-ide
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-orca-package-arm64.ps1
```
