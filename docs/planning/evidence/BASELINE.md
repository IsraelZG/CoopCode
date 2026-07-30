# Baseline conhecido

Estado verificado das verificações automáticas **antes** de qualquer tentativa
em curso. Um worker compara seu resultado contra este arquivo, nunca contra o
verde. Um reviewer trata como regressão apenas o que piora em relação a ele.

Este arquivo é evidência viva: quando o número muda, ele é reescrito com novo
commit e nova data. Não é histórico — o histórico está no Git.

## Suíte de testes do Orca

| Campo | Valor |
|---|---|
| Commit | `bccb83b080ca789e30312882315863d8fc6e7ce1` |
| Medido em | 2026-07-30 |
| Host | Windows 11 ARM64 |
| Arquivos de teste | **49 falhando** · 3619 passando · 25 pulados (3693) |
| Testes | **144 falhando** · 38246 passando · 471 pulados (38900) |
| Duração | 952 s |

As 144 falhas são pré-existentes ao snapshot importado do Orca. **Não são
regressão de nenhuma task da fila atual.** Nenhuma delas foi investigada ainda;
a lista por arquivo não foi capturada nesta medição.

### Como reproduzir

```powershell
cd C:\Dev2026\agentic-ide\apps\desktop\orca
$env:npm_config_virtual_store_dir_max_length='30'
C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd run test
```

Leva cerca de 16 minutos. **Nunca use isso como gate de task.**

### Rodar apenas os testes da sua task

Verificado em 2026-07-30, exit 0:

```powershell
C:\Dev2026\agentic-ide\tools\pnpm-arm64.cmd exec vitest run --config config/vitest.config.ts <caminho-do-teste>
```

`pnpm run test -- <caminho>` **não filtra** — roda os 3693 arquivos.

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
