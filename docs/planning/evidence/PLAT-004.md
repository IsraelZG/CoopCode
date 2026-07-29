# Evidência PLAT-004

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Checkout: `C:\Dev2026\external_repos\opencode`
- Commit: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Runtime de build: Bun `1.3.14`, `win32-arm64`
- Resultado: concluído

## Comando oficial

O script `packages/opencode/script/build.ts` aceita `--single` e filtra o alvo
pela plataforma e arquitetura do próprio processo Bun.

```text
rtk bun ./packages/opencode/script/build.ts --single
```

Antes do build:

```json
{"platform":"win32","arch":"arm64","version":"1.3.14"}
```

Não foram usados emulação x64, `--skip-install` ou alteração do target.

## Resultado do build

- Exit code: `0`.
- Target Bun: `bun-windows-arm64`.
- Renderer web embutido: build Vite concluído em `56.20s`.
- Dependências específicas instaladas pelo script:
  - `@opentui/core@0.4.5`;
  - `@parcel/watcher@2.5.1`;
  - `@ff-labs/fff-bun@0.9.4`.
- O smoke interno do script concluiu:

```text
Smoke test passed: 0.0.0-dev-202607281756
```

Os avisos Vite encontrados tratam de chunks grandes e imports mistos; não
interromperam o build nem indicaram fallback de arquitetura.

## Artefato

```text
C:\Dev2026\external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe
```

- Tamanho: `170229248` bytes.
- SHA-256:
  `ca7ec17072cbe8a2e2214621191a26591abaea8202cba693bddb7824f42fb209`.
- Assinatura PE: bytes `80, 69, 0, 0` (`PE\0\0`).
- Campo `Machine`: `0xAA64`, correspondente a ARM64.
- Metadados do pacote: `os: ["win32"]`, `cpu: ["arm64"]`.

Smoke manual fora do sandbox:

```text
rtk .\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe --version
0.0.0-dev-202607281756
```

## Integridade do checkout

O build oficial regravou `bun.lock` e `packages/opencode/package.json` enquanto
adicionava as dependências de target. Ao final, os hashes dos dois arquivos
eram idênticos aos blobs do commit. Após atualizar apenas os metadados do
índice:

- `git status --short`: vazio;
- `git diff --exit-code`: sucesso;
- `git diff --cached --exit-code`: sucesso.

## Conclusão

O build oficial produziu e executou um OpenCode PE ARM64 nativo no host
prioritário. `PLAT-005` pode validar `opencode serve`.
