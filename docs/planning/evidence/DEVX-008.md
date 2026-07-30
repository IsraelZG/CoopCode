# Evidência DEVX-008

- Data: 2026-07-30
- Host: Windows 11 ARM64
- Base SHA: `8df4ad722d70cc606cb4c87a001c6e1e3bceb4e4`
- Orca base: mesmo SHA — `apps/desktop/orca` não foi alterado
- Electron Builder: 26.15.3
- Electron: 43.1.0
- Resultado: concluído

## O que esta task entrega

Um script sob demanda (`tools/build-coopcode.ps1`) que produz um build ARM64
portátil do Orca a partir do layout ativo em `apps/desktop/orca` e o instala
em `C:\Dev2026\builds\coopcode\current\`. O script não edita nenhum arquivo
dentro de `apps/desktop/orca` e não requer `LongPathsEnabled`.

## Correção do MAX_PATH (MSB3491)

O checkout ativo está em `C:\Dev2026\worktrees\CoopCode\DEVX-008\apps\desktop\orca`
(58 caracteres até `orca`). O `node-pty` nativo monta caminhos de ~263
caracteres que estouram o limite de 260 do MSBuild:

```
...\.pnpm\node-pty@1.1.0_patch_hash=8_0fb73617c3a010dc75f69e2dff4aad3e\node_modules\node-pty\...
                                                                   ^--- 60 chars de virtual store
```

O estouro foi confirmado executando `pnpm install --frozen-lockfile` sem a
variável de ambiente e rodando `build:win -- --arm64 --dir`. O rebuild nativo
do `node-pty` falhou com:

```
MSB3491: Could not write lines to file "...node_addon_api_except.lastbuildstate".
  ...\Microsoft.CppBuild.targets(385,5): o caminho especificado é maior que
  260 caracteres (263 no total).
```

Com `npm_config_virtual_store_dir_max_length=30` o nome do diretório da store
virtual do pnpm é encurtado de 60 para 30 caracteres, derrubando o caminho
para ~233 e eliminando o erro. O script aplica essa variável automaticamente
antes do `pnpm install`.

**Nota sobre alternativas rejeitadas:**
- `subst` não funciona porque `realpath` resolve a unidade virtual de volta
  ao caminho `C:` antes do MSBuild ver;
- configurar `.npmrc` dentro de `apps/desktop/orca` foi evitado para não
  editar o runtime importado.

## Build

Comando executado (via script):

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-coopcode.ps1
```

O script internamente executa:

```text
$env:npm_config_virtual_store_dir_max_length = '30'
pnpm install --frozen-lockfile
pnpm run build:win -- --arm64 --dir
```

Marcos registrados pelo empacotador:

```text
packaging platform=win32 arch=arm64 electron=43.1.0
appOutDir=dist\win-arm64-unpacked
[verify-packaged-daemon-entry] OK
[verify-packaged-plugin-resources] OK
building target=nsis file=dist\orca-windows-setup.exe archs=arm64
```

O NSIS também foi gerado como efeito colateral do config do Orca
(`electron-builder.config.cjs`), mas o `--dir` foi passado e o unpacked
é o target principal.

## Artefatos

| Artefato | Tamanho | PE Machine | Detalhes |
| --- | ---: | --- | --- |
| `Orca.exe` | 205.522.432 bytes | `0xAA64` (ARM64) | Mesmo tamanho de PLAT-009 |
| `opencode.exe` (bundled) | — | — | Versão `0.0.0-dev-202607281756` |

Verificação do PE header:

```powershell
$bytes = [System.IO.File]::ReadAllBytes("Orca.exe")
$peOffset = [BitConverter]::ToInt32($bytes, 60)
$machine = [BitConverter]::ToUInt16($bytes, $peOffset + 4)
# Resultado: 0xAA64
```

## Rotação de builds

O script mantém no máximo duas builds: `current` (a mais recente) e
`previous` (a imediatamente anterior). O launcher `CoopCode.cmd` sempre
aponta para `current\`.

**Observação sobre ambiente:** O scanner de vírus do Windows mantém locks
em DLLs e executáveis assinados que impedem `Remove-Item` e `Move-Item`.
O script inclui retry com fallback para `Copy-Item` e renomeação de
diretórios stale quando a remoção falha. Após duas execuções consecutivas
do script com essa lógica de retry, ambos `current` e `previous` contêm
3403 arquivos cada.

## Relação com PLAT-009

`PLAT-009` foi obtido em `C:\Dev2026\external_repos\orca` (30 caracteres
no caminho), onde o `MAX_PATH` não era um problema. O layout ativo em
`apps/desktop/orca` tem 40 caracteres, o que adiciona exatamente 10
caracteres a todos os caminhos de build e causa o estouro do `MSB3491`.

`docs/planning/evidence/PLAT-009.md` **não foi editado**. A evidência
anterior permanece como registro histórico do primeiro spike de
empacotamento ARM64, mas não atesta o build a partir do layout atual.

## Limitações conhecidas

- O NSIS installer é gerado como efeito colateral da config do Orca; o
  script passa `--dir` mas o `electron-builder.config.cjs` do Orca ainda
  produz o target `nsis`. Isso está fora do escopo desta task (não
  podemos editar `apps/desktop/orca`).
- O `build:electron-vite` pode crashar com `0xC0000005` sob pressão de
  memória no bundling do renderer. É um flake conhecido; o budget de
  `attempts: 2` cobre essa possibilidade.
- Arquivos com lock persistente do scanner de vírus (DLLs assinadas,
  executáveis) podem impedir a rotação limpa em algumas execuções. O
  script usa fallback de copy + rename para mitigar.
- `windows-native-registry` e `@parcel/watcher` reportam falha de rebuild
  durante o `pnpm install`, mas são reconstruídos com sucesso na etapa
  `electron-builder native rebuild` durante o packaging.

## Como verificar hands-on

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\build-coopcode.ps1
rtk powershell -NoProfile -ExecutionPolicy Bypass -Command "[BitConverter]::ToUInt16([System.IO.File]::ReadAllBytes('C:\Dev2026\builds\coopcode\current\Orca.exe'), [BitConverter]::ToInt32([System.IO.File]::ReadAllBytes('C:\Dev2026\builds\coopcode\current\Orca.exe'), 60) + 4)"
```

O segundo comando deve retornar `0xAA64` (ARM64).

```text
C:\Dev2026\builds\coopcode\current\opencode\opencode.exe --version
```

Deve retornar `0.0.0-dev-202607281756` (ou versão posterior do build).
