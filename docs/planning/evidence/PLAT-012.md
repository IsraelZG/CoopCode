# Evidência PLAT-012

- Data: 2026-07-29
- Plataforma: GitHub-hosted `ubuntu-24.04-arm`
- Arquitetura comprovada: Linux ARM64/AArch64
- CoopCode: `d4043b19630949aa9f2691cca420910bc0a1cd0a`
- OpenCode: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Execução verde: <https://github.com/IsraelZG/CoopCode/actions/runs/30447010343>
- Resultado: concluído

## Provas executadas

### OpenCode

- runner, Node e Bun reportaram ARM64;
- instalação reproduzível com lockfile;
- build nativo produziu `opencode-linux-arm64/bin/opencode`;
- `file` confirmou AArch64;
- o binário compilado iniciou `opencode serve`;
- `GET /global/health` retornou `healthy=true`;
- processo e ambiente temporário foram encerrados com prazo limitado.

Job `opencode`: sucesso em 1m20s.

### CoopCode/Orca

- dependências de sistema declaradas foram instaladas;
- `build:release` compilou os componentes nativos;
- electron-builder gerou AppImage e `.deb` ARM64;
- `readelf` confirmou AArch64 em `orca-ide`, `node-pty` e `agent-browser`;
- `dpkg-deb` confirmou `Architecture: arm64`;
- o gate de piso glibc existente passou;
- hashes SHA-256 foram preservados nos artefatos.

Job `orca`: sucesso em 3m36s.

## Artefatos

| Artefato | Tamanho compactado |
|---|---:|
| `plat-012-opencode-linux-arm64-d4043b1...` | 60.740.146 bytes |
| `plat-012-orca-linux-arm64-d4043b1...` | 360.852.940 bytes |

Retenção configurada: 7 dias.

## Aprendizado das tentativas

Duas execuções anteriores foram canceladas pela concorrência após o smoke
expor esperas sem limite:

- `30446361207`: `wait` podia aguardar shutdown indefinidamente;
- `30446779082`: `curl` podia manter conexão sem resposta indefinidamente.

O harness passou a:

- conceder 5 segundos ao shutdown e depois forçar o término;
- limitar cada conexão/resposta de health a 1 segundo.

A execução final demonstrou que os dois limites removem o hang sem mascarar a
prova de health.

## Limitação

O resultado comprova build nativo em Ubuntu 24.04 ARM64 hospedado. Aceitação em
uma máquina física específica continua sendo etapa de release, não bloqueio do
desenvolvimento do coordinator/worker.

## Como verificar hands-on

Abra a execução verde e confirme os jobs `opencode` e `orca`:

<https://github.com/IsraelZG/CoopCode/actions/runs/30447010343>

Em **Artifacts**, baixe os dois arquivos. O artefato Orca deve conter:

```text
orca-linux-arm64.AppImage
orca-ide_<versão>_arm64.deb
artifacts/orca-elf.log
artifacts/orca-deb-architecture.log
artifacts/orca-sha256sums.txt
```

`orca-deb-architecture.log` deve conter `arm64`; `orca-elf.log` deve identificar
os binários como AArch64. Qualquer job vermelho ou ausência desses arquivos
invalida a prova.
