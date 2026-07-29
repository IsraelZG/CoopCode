# ADR-0001: Windows ARM64 como plataforma de referência

- Status: aceito
- Data: 2026-07-28

## Contexto

O produto precisa funcionar em Windows 11 ARM64, Windows 11 x64 e Linux ARM64.
Dependências nativas tornam Windows ARM64 o alvo com maior risco.

## Decisão

Windows 11 ARM64 é o primeiro gate de desenvolvimento e release. Windows 11 x64
é o segundo; Linux ARM64 é o terceiro. Funcionar por emulação x64 não comprova
suporte ARM64.

Linux ARM64 oferece coordinator e worker headless no MVP. Desktop Electron para
Linux não é requisito inicial.

## Consequências

- CI e smoke tests ARM64 são criados antes das features.
- Dependências sem binário ou build ARM64 são removidas, substituídas ou
  isoladas como opcionais.
- Speech, computer-use e helpers x64-only não bloqueiam o núcleo do produto.
- Nenhuma feature é considerada pronta sem evidência no alvo correspondente.
