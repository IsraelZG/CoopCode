# ADR-0002: Teste de segurança WAL do Crush exclui arquivo shm volátil

- Status: aceito
- Data: 2026-07-30

## Contexto

O critério 4 do DEVX-006 exige que o scan seja seguro com `crush.db-wal`
presente e Crush rodando, sem modificar `crush.db`, `crush.db-wal` ou
`crush.db-shm` (comparar hashes dos arquivos antes e depois).

Investigação empírica com `node:sqlite` (o motor SQLite do código via
`SyncDatabase`) demonstrou que o arquivo `-shm` (WAL shared-memory index) é
reescrito em qualquer abertura de conexão — inclusive leitura com
`PRAGMA query_only = ON` — sempre que um arquivo `-wal` existe. Reproduções:

- Banco em modo WAL com escritor ativo: hashes de `db` e `wal` inalterados
  após scan; `shm` alterado.
- Banco rollback com `wal` e `shm` artificiais: `shm` alterado após abertura
  read-only.
- Banco em modo WAL sem `wal` (fechamento limpo): abertura read-only cria
  `wal` e `shm` vazios.
- Banco rollback sem `wal`, apenas `shm` artificial: `shm` inalterado
  (`node:sqlite` não toca no shm quando não há wal).

Conclusão: o `-shm` é estado volátil de conexão (WAL index reconstruído), não
dados de sessão. Comparação byte-a-byte do `shm` é impossível no cenário real
(Crush rodando com escritor WAL ativo).

## Decisão

O teste de segurança WAL (critério 4) compara byte-a-byte apenas `crush.db` e
`crush.db-wal` (dados persistidos) e verifica continuidade funcional (o
escritor ativo continua lendo e escrevendo após o scan). O arquivo
`crush.db-shm` é intencionalmente excluído da comparação de hashes.

A propriedade de segurança provada é: dados persistidos intactos e escritor
funcional após o scan — que é a garantia correta para um leitor read-only
contra um banco WAL com escritor ativo.

## Consequências

- O teste prova a propriedade de segurança correta sem exigir uma garantia
  impossível do `node:sqlite`.
- O critério 4 do DEVX-006 é atualizado para refletir a exclusão do `shm`.
- Se o `node:sqlite` mudar o comportamento do WAL index no futuro, o teste
  continua válido (dados persistidos não são tocados).
- Qualquer scanner futuro que abra bancos SQLite em modo WAL deve seguir o
  mesmo padrão: comparar hashes de `db` + `wal`, não `shm`.
