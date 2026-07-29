# Evidência PLAT-013 — decisão do Platform Spike

- Data: 2026-07-29
- Decisão: **GO para iniciar CORE-001**
- Escopo da decisão: fundação de desenvolvimento da IDE, não release comercial

## Matriz final

| Prova | Windows 11 ARM64 | Windows x64 CI | Linux ARM64 CI |
|---|---|---|---|
| toolchain nativa | aprovado | aprovado | aprovado |
| build OpenCode | aprovado | aprovado | aprovado |
| `opencode serve` + health | aprovado | aprovado | aprovado |
| build CoopCode/Orca | aprovado | aprovado | aprovado |
| inspeção de assets nativos | aprovado | aprovado | aprovado |
| packaging | NSIS aprovado | NSIS aprovado | AppImage + deb aprovados |
| execução hospedada | `30414301514` | `30447234690` | `30447010343` |
| aceitação física | aprovada no host | pendente para release | pendente para release |

## Evidências

- Windows ARM64: [`PLAT-010.md`](PLAT-010.md)
- Windows x64: [`PLAT-011.md`](PLAT-011.md)
- Linux ARM64: [`PLAT-012.md`](PLAT-012.md)
- Higiene do fork: [`COOPCODE-HYGIENE.md`](COOPCODE-HYGIENE.md)

## Decisão por plataforma

### Windows 11 ARM64 — GO

É a plataforma de referência. Build, execução local, integração Orca→OpenCode,
packaging e CI nativos passaram. As lacunas de `agent-browser` e ditado offline
continuam feature-gated e não bloqueiam o coordinator/worker.

### Windows x64 — GO para desenvolvimento

Build, servidor, packaging e módulos nativos passaram em runner Windows x64.
O instalador deve receber um smoke em Windows 11 x64 físico antes do release,
porque o runner hospedado usa Windows Server 2025.

### Linux ARM64 — GO para worker/coordinator headless

Build, servidor, piso glibc, AppImage e `.deb` passaram em Ubuntu 24.04 ARM64.
Execução visual/instalação em hardware físico será aceita quando DIST-004
conectar o primeiro worker Linux ARM64; não bloqueia o vertical slice local.

## Condições que permanecem

- manter os três workflows nativos ativos;
- não tratar runner x64 como aceite visual de Windows 11;
- preservar os feature gates ARM64 já registrados;
- não expandir o Platform Spike para macOS/Linux x64;
- executar gates físicos antes de publicar instaladores comerciais.

Nenhuma dessas condições impede o protocolo coordinator/worker.

## Próxima tarefa

`CORE-001 — Definir protocolo coordinator/worker`.

O primeiro vertical slice deve continuar em uma máquina e usar HTTP/JSON
mínimo: registro, lease, heartbeat, evento, conclusão e liberação.

## Como verificar hands-on

Abra os três runs:

- <https://github.com/IsraelZG/CoopCode/actions/runs/30414301514>
- <https://github.com/IsraelZG/CoopCode/actions/runs/30447234690>
- <https://github.com/IsraelZG/CoopCode/actions/runs/30447010343>

Todos devem exibir conclusão `success` e dois jobs verdes.

Depois, abra `.context/plans/mvp.yaml`: `PLAT-010`, `PLAT-011`, `PLAT-012` e
`PLAT-013` devem estar `completed`; `CORE-001` deve estar `ready`.
