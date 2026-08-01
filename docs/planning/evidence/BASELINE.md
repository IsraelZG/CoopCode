# Baseline conhecido

Estado verificado das verificações automáticas **antes** de qualquer tentativa
em curso. Um worker compara seu resultado contra este arquivo, nunca contra o
verde. Um reviewer trata como regressão apenas o que piora em relação a ele.

Este arquivo é evidência viva: quando o número muda, ele é reescrito com novo
commit e nova data. Não é histórico — o histórico está no Git.

## Suíte de testes do Orca

| Campo | Valor |
|---|---|
| Commit | `0d0f8d36f38399462858e05588c56fcbc32c43cf` |
| Medido em | 2026-07-31 |
| Host | Windows 11 ARM64 |
| Arquivos de teste | **51 falhando** · 3618 passando (3695, ver nota) |
| Testes | **147 falhando** (contagem derivada de log, ver nota) |
| Duração | não determinada — a suíte trava antes de imprimir o resumo (ver DEVX-013-triage.md) |

**Estes números são derivados linha a linha do log do reporter, não de um
resumo limpo.** A suíte inteira (`pnpm run test`) rodou todos os 3695 arquivos
até o fim (linhas por arquivo presentes no log), mas o processo `vitest`
**travou no teardown antes de imprimir o resumo final e antes de escrever o
reporter JSON** — confirmado travamento real (não lentidão): delta de CPU zero
nos 3 processos node sobreviventes ao longo de uma amostra de 45s, log
congelado por 12+ minutos antes do kill manual. Ver
`docs/planning/evidence/DEVX-013-triage.md` para a análise completa; o
candidato mais provável para a causa é `config/scripts/resolve-7za-path.test.mjs`,
cujos testes chamam `app-builder-lib`'s `getPath7za()` (subprocess real e
possível download de rede) sem timeout garantido neste host.

As 147 falhas são majoritariamente pré-existentes ao snapshot importado do
Orca, mas **18 dos 51 arquivos foram classificados como signal** (defeito real,
não ruído de importação) nesta medição — ver DEVX-013-triage.md para a lista
completa com uma frase de causa por arquivo e o que mudaria para cada achado
de signal. **Não são regressão de nenhuma task da fila atual** (mesma
conclusão da medição anterior), mas alguns indicam bugs reais de
cross-platform (Windows) que valem uma task própria.

### Como reproduzir

```powershell
cd C:\Dev2026\agentic-ide\apps\desktop\orca
$env:npm_config_virtual_store_dir_max_length='30'
C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run test
```

**A suíte completa trava no teardown neste host antes de imprimir o resumo ou
escrever `--reporter=json`** (ver acima). Rodar a partir de um `cmd.exe`
destacado (não do Git Bash — binários MSYS na PATH resolvem `ps`/`cat` errados)
e capturar stdout/stderr em arquivo é a única forma prática de extrair
contagens, e mesmo assim só linha a linha, nunca do resumo. Leva ~21 minutos
até travar (não ~16 min como medido anteriormente). **Nunca use isso como gate
de task — e não espere um resumo limpo ao fim.**

**2026-08-01 (DEVX-015):** O arquivo `config/scripts/resolve-7za-path.test.mjs`
agora roda isoladamente até o fim (15 testes, ~812ms) sem travar. A causa raiz
eram duas: (a) o shebang `#!/usr/bin/env node` na linha 1 de
`resolve-7za-path.mjs` que o vitest não parseava, impedindo até a carga do
arquivo; (b) as chamadas a `app-builder-lib`'s `getPath7za()` dentro dos
testes, que disparavam download/subprocess reais sem timeout. Um seam de
ambiente (`__ORCA_MOCK_7ZA_PATH`) evita o download em testes; o caminho de
produção por `getPath7za()` continua inalterado. A suíte completa **não foi
re-executada até o fim** nesta task (tomaria ~21 min; o gate mensurável é o
arquivo individual). Se ainda travar no teardown, a causa remanescente é um
finding — não perseguir aqui.

### Rodar apenas os testes da sua task

Verificado em 2026-07-31, exit 0:

```powershell
C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts <caminho-do-teste>
```

`pnpm run test -- <caminho>` **não filtra** — roda os 3695 arquivos. Este
comando com um caminho explícito é seguro mesmo com a suíte completa travando
no teardown: cada arquivo roda isolado e termina, e foi o método usado para
confirmar cada uma das 51 falhas em `DEVX-013-triage.md`.

## Empacotamento Windows ARM64

| Campo | Valor |
|---|---|
| Commit | `bccb83b080ca789e30312882315863d8fc6e7ce1` |
| Medido em | 2026-07-30 |
| Estado | verde, com correção obrigatória |

O build só passa com `npm_config_virtual_store_dir_max_length=30` definido no
install. Sem isso, falha com `MSB3491` (caminho de 263 caracteres contra o
limite de 260 do MSBuild) no rebuild nativo do `node-pty`.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\Dev2026\agentic-ide\tools\build-coopcode.ps1
```

`docs/planning/evidence/PLAT-009.md` registra aprovação obtida em
`C:\Dev2026\external_repos\orca` e **não vale para o layout atual**; ver
`DEVX-008`.

Falha intermitente observada uma vez e não reproduzida: `build:electron-vite`
abortou com `0xC0000005` sob pressão de memória.

## Runtime OpenCode

| Campo | Valor |
|---|---|
| Versão | `0.0.0-dev-202607281756` |
| Medido em | 2026-07-30 |
| `opencode serve` | ✅ nativo ARM64 — `/global/health` verde, `/` devolve a UI web |
| TUI (`opencode` interativo) | ❌ **não funciona em Windows ARM64** |

A TUI falha em `bun:ffi dlopen()`, desabilitado nos builds win-arm64 do Bun
(TinyCC ausente). Reproduz também fora do binário compilado, rodando do fonte.
Bun `1.3.14` é a versão mais recente publicada; não há para onde atualizar.

## Quando atualizar

- Ao integrar qualquer task que altere um destes números.
- Ao trocar a versão do snapshot do Orca, do OpenCode ou da toolchain.
- Quando um reviewer descobrir que a medição não reproduz mais.

Baseline vencida é pior que baseline ausente: ela faz um worker chamar de
normal uma quebra que ele mesmo causou.
