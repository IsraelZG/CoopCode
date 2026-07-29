# Suggested commands
- Todo comando shell, inclusive cada segmento encadeado, começa com `rtk`.
- PowerShell/Windows ARM64 toolchain local:
  - `rtk tools\node-arm64.cmd <args>`
  - `rtk tools\pnpm-arm64.cmd <args>`
  - `rtk cmd /c tools\bun-arm64.cmd <args>`
- Inspeção compacta: `rtk ls <path>`, `rtk read <file>`, `rtk grep <pattern>`, `rtk git status`, `rtk git diff`.
- OpenCode usa seus próprios comandos Bun no checkout externo; não converter lockfiles nem instalar por outro gerenciador.
- Use caminhos Windows explícitos; upstreams ficam em `C:\Dev2026\external_repos`.