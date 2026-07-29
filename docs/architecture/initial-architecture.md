# Arquitetura inicial

## Componentes

### Desktop e web

O renderer web é compartilhado. No Windows, Electron adiciona integração com o
sistema operacional. No Linux ARM64, o coordinator serve a mesma UI pelo
navegador.

### Coordinator

Único proprietário de:

- projetos e tarefas;
- dependências e prioridades;
- registro de workers;
- leases, heartbeats e tentativas;
- eventos e políticas de autonomia;
- índice de previews e artefatos.

O MVP usa `node:sqlite`, aberto somente pelo coordinator.

### Worker

Cada worker:

- anuncia plataforma, arquitetura, toolchains e capacidade;
- mantém clones e worktrees locais;
- supervisiona o runtime agêntico e processos de desenvolvimento;
- executa gates determinísticos;
- publica branches/commits por Git;
- envia eventos e artefatos ao coordinator.

### Runtime agêntico

OpenCode é o único motor. Durante o MVP ele roda como processo supervisionado.
Integração visual e operacional não exige que todos os componentes estejam no
mesmo processo.

## Protocolo mínimo

```text
register worker
request lease
accept lease
heartbeat
append event
complete attempt
release lease
```

HTTP/JSON é suficiente para o primeiro vertical slice. Streaming e WebSocket
entram somente quando logs ou interação em tempo real exigirem.

## Estado

| Estado | Proprietário |
|---|---|
| Documentação e ADRs | Git |
| Código e histórico | Git |
| Tarefas, leases e eventos | Coordinator SQLite |
| Sessão agêntica | Runtime OpenCode |
| Clones e worktrees | Worker local |
| Traces e evidências | `.context` e artifact store |

## Integração entre máquinas

Não existe filesystem compartilhado. Cada worker parte de um commit base,
produz uma branch e publica o resultado em um remoto Git. O integrador é o único
responsável por atualizar a branch de destino.

## Estratégia de implementação

1. Provar Windows ARM64.
2. Executar um vertical slice em uma máquina.
3. Separar coordinator e worker na mesma máquina.
4. Conectar Windows x64.
5. Conectar Linux ARM64.
6. Adicionar autonomia overnight.

## Produtos externos à IDE

Inferência local e participação em uma rede de compute/storage pertencem ao
CoopRouter, não ao coordinator da IDE. Os limites entre CoopCode, CoopRouter e
CoopCloud estão em
[`coopcode-cooprouter-boundaries.md`](coopcode-cooprouter-boundaries.md).
