# Tech stack
- Plataforma de referência: Windows 11 ARM64 (`win32-arm64`). Secundárias: Windows x64 e Linux ARM64.
- Toolchain local Windows ARM64: Node 24.18.0 ARM64 em `.toolchains/node-v24.18.0-win-arm64`, pnpm 10.24.0 local e Bun 1.3.14 ARM64; `.toolchains/` é ignorado pelo Git.
- OpenCode upstream usa Bun; checkout em `C:\Dev2026\external_repos\opencode`.
- Orca upstream usa Node 24/pnpm; checkout em `C:\Dev2026\external_repos\orca`.
- Desktop planejado: Electron; UI web compartilhada. Linux ARM64 é coordinator/worker headless no MVP.
- Persistência planejada: `node:sqlite`, aberto somente pelo coordinator.
- Primeiro protocolo coordinator/worker: HTTP/JSON; streaming/WebSocket somente quando exigido por logs/interação.