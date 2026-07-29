# Evidência PLAT-005

- Data: 2026-07-28
- Host: Windows 11 ARM64
- Checkout: `C:\Dev2026\external_repos\opencode`
- Commit: `017a5977d2107092007623e507fc5c6eb337d3b2`
- Binário: `opencode-windows-arm64\bin\opencode.exe`
- Versão: `0.0.0-dev-202607281756`
- Resultado: concluído

## Interface oficial

O help do binário confirma:

```text
opencode serve
--hostname  string  default "127.0.0.1"
--port      number  default 0
--pure      run without external plugins
```

O endpoint oficial usado pelos testes upstream para readiness é:

```text
GET /global/health
```

Resposta esperada:

```json
{"healthy":true,"version":"0.0.0-dev-202607281756"}
```

## Smoke reproduzível

Foi criado
`tools\verify-opencode-serve-arm64.ps1`, sem dependências externas. Ele:

1. confirma que a porta está disponível;
2. inicia o binário em `127.0.0.1:4096` com `--pure`;
3. aguarda `GET /global/health`;
4. encerra o subprocesso;
5. confirma que o processo terminou e que a porta pode ser aberta novamente.

Comando executado:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-opencode-serve-arm64.ps1
```

Primeira execução:

```text
Result  : PASS
Pid     : 9544
Uri     : http://127.0.0.1:4096/global/health
Healthy : True
Version : 0.0.0-dev-202607281756
Shutdown: PASS (processo encerrado; porta 4096 liberada)
```

Segunda execução, na mesma porta:

```text
Result  : PASS
Pid     : 38300
Uri     : http://127.0.0.1:4096/global/health
Healthy : True
Version : 0.0.0-dev-202607281756
Shutdown: PASS (processo encerrado; porta 4096 liberada)
```

A repetição na porta `4096` comprova que a primeira execução não deixou
processo ou socket órfão.

## Autenticação e encerramento

Se `OPENCODE_SERVER_PASSWORD` estiver definido, `/global/health` exige Basic
Auth. O script remove essa variável somente do ambiente herdado pelo
subprocesso e preserva o ambiente do terminal, sem ler ou registrar o valor.

O comando `serve` upstream não expõe shutdown HTTP nem handler próprio de
sinais. O verificador encerra explicitamente o subprocesso e valida a liberação
da porta.

## Como verificar hands-on

Na raiz `C:\Dev2026\agentic-ide`:

```text
rtk powershell -NoProfile -ExecutionPolicy Bypass -File tools\verify-opencode-serve-arm64.ps1
```

Sucesso exige, na mesma execução:

- `Result : PASS`;
- `Healthy : True`;
- versão `0.0.0-dev-202607281756`;
- `Shutdown: PASS`;
- exit code `0`.

Para observar a resposta no navegador, mantenha o servidor aberto em um
terminal:

```text
rtk C:\Dev2026\external_repos\opencode\packages\opencode\dist\opencode-windows-arm64\bin\opencode.exe serve --hostname 127.0.0.1 --port 4096 --pure
```

Abra `http://127.0.0.1:4096/global/health`. Deve aparecer JSON com
`"healthy": true`. Pressione `Ctrl+C` no terminal ao terminar.

## Conclusão

`opencode serve` inicia e responde nativamente em Windows ARM64, e seu processo
pode ser supervisionado sem deixar a porta ocupada. `PLAT-006` é a próxima
tarefa do Platform Spike.
