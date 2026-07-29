# Evidência PLAT-010

- Data: 2026-07-28
- Status: concluído
- Host da validação local: Windows 11 ARM64
- Repositório de implementação: `C:\Dev2026\external_repos\orca`

## Runner e escopo

O GitHub Actions oferece o runner hospedado ARM64 padrão
[`windows-11-arm`](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
A pipeline usa esse rótulo diretamente e falha se `RUNNER_ARCH`, arquitetura
do sistema operacional e arquitetura do processo não forem ARM64.

O workflow permanece não obrigatório. Um trigger restrito à branch
`plat-010-windows-arm64` permite a primeira execução antes de o arquivo existir
na branch padrão; `workflow_dispatch` permite reexecuções depois da publicação.
Ele automatiza somente as provas aprovadas nas tarefas anteriores:

1. checkout do Orca;
2. checkout do OpenCode no commit aprovado
   `017a5977d2107092007623e507fc5c6eb337d3b2`;
3. Node 24 ARM64, pnpm 10.24.0 e Bun 1.3.14;
4. build nativo do OpenCode com `--single`;
5. validação PE ARM64 e smoke de `GET /global/health`;
6. teste focal do contrato de assets do Orca;
7. packaging NSIS do Orca com `--arm64`;
8. inspeção dos executáveis e módulos nativos;
9. upload dos binários e logs mesmo quando houver falha.

Não há assinatura, publicação de release, emulação x64 ou alteração da
distribuição do produto.

## Arquivos

- Workflow:
  `C:\Dev2026\external_repos\orca\.github\workflows\windows-arm64-spike.yml`
- Gate do OpenCode:
  `C:\Dev2026\external_repos\orca\tools\windows-arm64-spike\verify-opencode-serve.ps1`
- Gate do pacote:
  `C:\Dev2026\external_repos\orca\tools\windows-arm64-spike\verify-orca-package.ps1`

O workflow usa dois jobs ARM64, pois as dependências instaladas localmente
ocupam aproximadamente `4,95 GiB` no OpenCode e `2,46 GiB` no Orca, antes dos
caches. Separá-los preserva margem no disco de `14 GB` do runner e mantém os
diagnósticos independentes.

Os artefatos hospedados terão os nomes `opencode-windows-arm64-<commit>` e
`orca-windows-arm64-<commit>`, ambos com retenção de sete dias. O primeiro
contém logs e o executável OpenCode ARM64; o segundo contém logs, instalador
Orca e diagnóstico do electron-builder.

## Validação local

Todos os comandos abaixo terminaram com exit code `0`.

```text
rtk node -e "<parse YAML e confirmar runs-on>"
YAML PASS: Windows ARM64 Native Spike windows-11-arm
```

```text
rtk pwsh -NoProfile -Command "<parse dos dois scripts>"
PowerShell PASS: tools/windows-arm64-spike/verify-opencode-serve.ps1
PowerShell PASS: tools/windows-arm64-spike/verify-orca-package.ps1
```

```text
rtk pwsh -NoProfile -File tools/windows-arm64-spike/verify-opencode-serve.ps1 ...
Result    : PASS
PeMachine : 0xAA64
Healthy   : True
Shutdown: PASS (process stopped; port 4096 released)
```

```text
rtk pnpm exec vitest run --config config/vitest.config.ts src/main/cli/packaged-cli-assets.test.ts
Test Files  1 passed (1)
Tests       2 passed | 3 skipped (5)
```

```text
rtk pwsh -NoProfile -File tools/windows-arm64-spike/verify-orca-package.ps1
Package ARM64 checks: 12 passed, 0 failed
```

```text
rtk git diff --check
exit code 0
```

O gate confirmou novamente:

- `Orca.exe` e oito payloads nativos com PE Machine `0xAA64`;
- launcher CLI gerenciado AnyCPU;
- ausência de payloads x64 conhecidos;
- instalador com `173689106` bytes e SHA-256
  `ddad0e129143b82546900ad968472f963c13b6dde5c9b39888db48c66d8a5c9d`;
- `Orca.exe` com `205522432` bytes e SHA-256
  `c327e758d1b3c27458a157a51d4217e09d6e4585ed5d5fbfd6bca55a64fc4489`.

## Repositório e execução hospedada

O fork principal do projeto foi criado como
[`IsraelZG/CoopCode`](https://github.com/IsraelZG/CoopCode). O checkout local
mantém:

- `origin`: `https://github.com/IsraelZG/CoopCode.git`;
- `upstream`: `https://github.com/stablyai/orca.git`;
- branch: `plat-010-windows-arm64`;
- commit aprovado: `41a17d46bc43c29be7a8bcad15f100da8fac09e4`.

A integração está preparada no
[PR em rascunho #1](https://github.com/IsraelZG/CoopCode/pull/1); a branch
`main` não foi alterada.

A execução conclusiva foi o
[run `30414301514`](https://github.com/IsraelZG/CoopCode/actions/runs/30414301514),
disparado por push em 2026-07-29:

- status: `completed`;
- conclusão: `success`;
- `OpenCode build + serve`: sucesso em `14m45s`;
- `Orca package`: sucesso em `9m57s`;
- runner dos dois jobs: `windows-11-arm`;
- `RUNNER_ARCH`, OS, processo, Node e Bun: ARM64 nativos;
- smoke OpenCode, inspeção do pacote Orca e ambos os uploads: `success`.

## Artefatos hospedados

Os dois artefatos expiram em 2026-08-05:

### OpenCode

- nome:
  `opencode-windows-arm64-41a17d46bc43c29be7a8bcad15f100da8fac09e4`;
- artifact ID: `8709811310`;
- tamanho do arquivo ZIP hospedado: `59197969` bytes;
- digest do artifact:
  `sha256:525aaf2ae1234c77dd20af348680fdd1775c7133f5c587be0aed8b5d613d36e0`;
- `opencode.exe`: `170310656` bytes;
- SHA-256 do executável:
  `ef256df9ca622774a2f8d342e011c66152d8d3f3ccb769665a6695e5ccf7dab6`.

O executável baixado foi novamente executado no host ARM64:

```text
Result    : PASS
PeMachine : 0xAA64
Healthy   : True
Shutdown: PASS (process stopped; port 4096 released)
```

### Orca

- nome:
  `orca-windows-arm64-41a17d46bc43c29be7a8bcad15f100da8fac09e4`;
- artifact ID: `8709720370`;
- tamanho do arquivo ZIP hospedado: `173353693` bytes;
- digest do artifact:
  `sha256:96bcead79bdf05732ef5fc93e167839cf08110c70bac957dfd4d76a442ffd6a2`;
- `orca-windows-setup.exe`: `173575552` bytes;
- SHA-256 do instalador:
  `d2683af7bbf6eb00251b32f35c3c0dab65b5b2dcab5e799321c9894fcaf2ca41`.

O log hospedado contém o marcador de conclusão do block map e não contém
`ELIFECYCLE` nem a falha de publicação implícita. O step
`Verify Orca ARM64 package` terminou com `success`.

## Aprendizado do primeiro run

O primeiro
[run `30412910991`](https://github.com/IsraelZG/CoopCode/actions/runs/30412910991)
falhou com dois diagnósticos reproduzíveis:

1. o electron-builder detectou `CI` e tentou publicar sem `GH_TOKEN`, mesmo
   após gerar o instalador; o spike agora passa `--publish never`;
2. o build do OpenCode resolveu `npm_config_node_gyp` para um módulo local
   inexistente durante o lifecycle de `tree-sitter-powershell`; o workflow
   materializa `node-gyp@13.0.1` com `--no-save --ignore-scripts`.

As duas correções estão somente no workflow. Nenhum token de publicação foi
adicionado, e os manifests/lockfiles do OpenCode permaneceram inalterados.
