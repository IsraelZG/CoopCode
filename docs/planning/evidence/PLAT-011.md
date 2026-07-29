# Evidência PLAT-011

- Data: 2026-07-29
- Plataforma de CI: GitHub-hosted `windows-2025`
- Arquitetura comprovada: Windows x64
- CoopCode: `65cfc7d045514bd6d60fee776de776c492678468`
- OpenCode: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Execução verde: <https://github.com/IsraelZG/CoopCode/actions/runs/30447234690>
- Resultado: concluído para build nativo; aceitação física Windows 11 pendente para release

## Provas executadas

### OpenCode

- runner, sistema, processo, Node e Bun reportaram x64;
- instalação reproduzível com lockfile;
- build nativo produziu `opencode-windows-x64/bin/opencode.exe`;
- cabeçalho PE confirmou Machine `0x8664`;
- o executável compilado iniciou `opencode serve`;
- `GET /global/health` retornou `healthy=true`;
- processo foi encerrado ao final.

Job `opencode`: sucesso em 12m26s.

### CoopCode/Orca

- runner, sistema, processo e Node reportaram x64;
- build desktop e componentes nativos terminaram;
- electron-builder gerou NSIS e diretório `win-unpacked`;
- cabeçalhos PE confirmaram x64 em:
  - `Orca.exe`;
  - cinco assets ConPTY/node-pty;
  - Parcel watcher;
  - Windows native registry;
  - `agent-browser`;
  - `sherpa-onnx`;
- instalador foi preservado sem publicação.

Job `orca`: sucesso em 7m07s.

## Artefatos

| Artefato | Tamanho compactado | Digest |
|---|---:|---|
| `opencode-windows-x64-65cfc7d...` | 60.869.127 bytes | `sha256:62d671ad...c5045c6d8` |
| `orca-windows-x64-65cfc7d...` | 455.560.787 bytes | `sha256:3ecf30a1...88398da4e` |

Retenção configurada: 7 dias.

## Aprendizado da primeira tentativa

O run `30446331258` comprovou build e packaging, mas o smoke OpenCode falhou
antes de iniciar o processo:

```text
Cannot overwrite variable HOME because it is read-only or constant.
```

PowerShell não diferencia `$home` da variável automática `$HOME`. O harness
foi corrigido para `$isolatedHome`; a execução final passou sem alterar o
OpenCode ou o produto.

## Limitação

O runner `windows-2025` é Windows Server 2025 x64. Ele comprova toolchain,
binários, servidor e packaging nativos x64, mas não substitui um smoke do
instalador em Windows 11 x64 físico antes do release.

## Como verificar hands-on

Abra:

<https://github.com/IsraelZG/CoopCode/actions/runs/30447234690>

Confirme os jobs `opencode` e `orca` verdes. Em **Artifacts**, baixe os dois
arquivos. O artefato Orca deve conter:

```text
dist/orca-windows-setup.exe
dist/win-unpacked/Orca.exe
artifacts/orca-verification.log
```

O log deve terminar com `Orca x64 package: PASS`.

Para aceitação física, copie o instalador para uma máquina Windows 11 x64,
instale, abra o CoopCode e inicie uma aba OpenCode sem enviar prompt. Codex não
é necessário nessa máquina.
