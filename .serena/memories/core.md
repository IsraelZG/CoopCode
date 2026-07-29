# Project core
- IDE agêntica integrada e distribuída; fase atual: Platform Spike.
- Fonte da verdade: requisitos em `docs/product/`, arquitetura vigente em `docs/architecture/`, decisões em `docs/adr/`, backlog humano em `docs/planning/`, DAG executável em `.context/plans/mvp.yaml`.
- Prioridade/gate invariável: Windows 11 ARM64, depois Windows 11 x64, depois Linux ARM64. Emulação x64 não conta como suporte ARM64.
- Upstreams ficam isolados em `C:\Dev2026\external_repos`; não importar/mesclar durante o spike.
- Componentes planejados: Electron em `apps/desktop`, renderer em `apps/web`, coordinator em `services/coordinator`, worker em `services/worker`, protocolo em `packages/protocol`, runtime OpenCode em `packages/agent-runtime`.
- Coordinator é dono de tarefas/leases/eventos/SQLite; workers mantêm clones/worktrees locais e integram por branches Git, nunca por filesystem compartilhado.
- Runtime agêntico único: OpenCode.
- Leia `mem:tech_stack` para toolchain, `mem:conventions` para limites arquiteturais, `mem:suggested_commands` para comandos Windows e `mem:task_completion` para gates de conclusão.