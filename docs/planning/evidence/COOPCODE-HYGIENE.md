# Evidência — higiene inicial do fork CoopCode

- Data: 2026-07-29
- Repositório: <https://github.com/IsraelZG/CoopCode>
- Resultado: concluído

## Inventário encontrado

| ID | Workflow | Estado final | Decisão |
|---|---|---|---|
| 322623652 | Computer-use e2e | `disabled_manually` | herdado; fora do platform spike e possui schedule |
| 322623654 | PR Checks | `disabled_manually` | suíte upstream ampla e dispendiosa; será substituída por gates CoopCode |
| 322623653 | Track Community PRs | `disabled_manually` | depende de segredo `BUFO_BOT_PRIVATE_KEY` e Project 13 da `stablyai` |
| 322623651 | Windows Crash-Survival E2E | `disabled_manually` | regressão upstream fora do platform spike |
| 322606173 | Windows ARM64 Native Spike | `active` | gate CoopCode validado em PLAT-010 |
| 322901997 | Windows x64 Native Spike | `active` | gate CoopCode de PLAT-011 |
| 322902297 | PLAT-012 Linux ARM64 Spike | `active` | gate CoopCode de PLAT-012 |

A branch `main` não possuía branch protection nem rulesets no momento da
auditoria. Nenhuma regra foi removida.

## Política temporária

Durante o platform spike, apenas workflows criados explicitamente para
PLAT-010, PLAT-011 e PLAT-012 ficam ativos. Workflows do upstream não são
apagados: permanecem no histórico e podem ser reavaliados individualmente
quando houver um gate de produto correspondente.

## Como verificar hands-on

No terminal autenticado com GitHub CLI:

```text
rtk gh api repos/IsraelZG/CoopCode/actions/workflows --jq '.workflows[] | [.id,.state,.name] | @tsv'
```

Os quatro workflows herdados listados acima devem retornar
`disabled_manually`; os três workflows de Platform Spike devem retornar
`active`.

Também é possível abrir:

<https://github.com/IsraelZG/CoopCode/actions>
