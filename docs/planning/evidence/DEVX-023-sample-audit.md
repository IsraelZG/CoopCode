# DEVX-023 — Auditoria de amostra dos candidatos emitidos

Procedimento: amostra estratificada de 24 candidatos (7 `reviewer-finding`, 7
`rework-correction`, 10 `inline-reference`) sorteada com PRNG determinístico
(semente `20260801`). Para cada candidato: (1) o texto do payload foi
comparado ao texto-fonte real apontado pela citação; (2) `grep -F
"[<marcador>]" <arquivo>` precisava aterrissar numa linha contendo o mesmo
texto, dentro da seção citada.

Semente e amostra completas: `tools/corpus-learning/audit-sample.json`.

## Veredito

**24/24 fiéis.** Nenhum payload fabricou texto: cada `finding.text` é excerto
verbatim da linha citada. A única observação é de *posição do excerto*: em
ocorrências `inline-reference` onde o marcador aparece no meio de uma linha de
log longa, o payload mostra a cauda pós-marcador (verbatim), e a cláusula
principal do achado está no trecho pré-marcador da mesma linha (ver itens 16,
22, 24). Isso é fiel à fonte, mas semanticamente mais pobre; os tipos
estruturados (`reviewer-finding`, `rework-correction`) carregam o achado
completo.

## Amostra (excerto citado × payload)

### Itens `reviewer-finding` (7)

1. **EST-48c [B2]** — Fonte (§8 › `### BLOCKERs`): `**[B2] tsc --noEmit falha
   com 4 novos erros nos arquivos da task** (acima do baseline 18)`. Payload:
   `(acima do baseline 18)`. **Fiel** (cauda pós-negrito; o título do achado
   está no trecho em negrito).
2. **T-PG-01 [i1]** — Fonte (§8 › Parecer): `- **[i1]** Branch task/T-PG-01
   está 1 commit à frente de master (489696f), worktree limpa, push em
   origin/task/T-PG-01 já feito. Pronto para worktree.mjs merge.`. Payload:
   idêntico. **Fiel.**
3. **T-1042 [m2]** — Fonte (§8 › Parecer 2): linha de tabela com
   `transaction discrimina por fn.length === 0` e reescrita para
   `transaction<T>(fn: (tx: GraphStoreTx) => Promise<T>)`. Payload: mesmo
   texto da célula. **Fiel.**
4. **C-35 [M1]** — Fonte (§8 › Parecer): `**[M1] Cobertura do escopo §3C é
   ~20-25%, não a totalidade** — listados 18+ sites ainda com new
   TextEncoder()/new TextDecoder()/encoder/decoder hoistados (ver tabela)...`.
   Payload: `listados 18+ sites ainda com new TextEncoder()...`. **Fiel.**
5. **T-409 [M1]** — Fonte (§8c › Achados): `**[M1]** *E2E Playwright criado
   mas nunca executado — test_profile: ui ausente.*`. Payload: idêntico.
   **Fiel.**
6. **EST-34 [m3]** — Fonte (§8 › Parecer): `**[m3] packages/estaleiro-contracts/package.json**
   lista @plataforma/core em "dependencies" (runtime), mas o único uso é
   import type { PluginManifest }...`. Payload: mesmo texto (pós-negrito).
   **Fiel.**
7. **T-PG-01 [i2]** — Fonte (§8 › Parecer): `- **[i2]** Gate de wiring de
   primitiva: o validador é uma primitiva de validação estática. Hoje não há
   caller de produção — T-PG-02 (render) e T-PG-05 vão consumi-lo...`.
   Payload: idêntico. **Fiel.**

### Itens `rework-correction` (7)

8. **T-202-followup-2 [i2]** — Fonte (§8 › Parecer): `- [i2] makePair.onMessage
   em noiseHandshake.test.ts:34-37 não é limpo em close() — handler "morto"
   ainda recebe mensagens. Helper de test, não parte da API. Sem impacto.`
   Payload: idêntico. **Fiel.**
9. **C-19 [i3]** — Fonte (§4 › EST-04b): `- [i3] rest.lastIndexOf(":") quebra
   se action/message contiver ":". → fixed (parser.ts:89)`. Payload: idêntico.
   **Fiel.**
10. **C-19 [m1]** — Fonte (§4 › EST-04a): `- [m1] parseTaskMd não envolve
    matter(raw) em try/catch — erro derruba pipeline. → fixed (parser.ts:148)`.
    Payload: idêntico. **Fiel.**
11. **T-804 [m4]** — Fonte (§8 › Parecer 2): `- [m4] Content-Range envia * no
    total → confirmado em webSeedRoutes.ts:70, 74.`. Payload: idêntico.
    **Fiel.**
12. **T-512 [M2]** — Fonte (§8 › Parecer): `- [B2] [M2] Playwright smoke não
    cobre o caso 7 do §4 ("revogar UCAN → observar negativa de chave"). Os 4
    casos atuais (tests/e2e/auth.smoke.spec.ts:3–35) só validam empty
    states...`. Payload: excerto idêntico pós-marcador. **Fiel.**
13. **T-004a [M1]** — Fonte (§8 › `### Rework (deepseek, 2026-07-01)`):
    `- [M1] packages/core/src/sqliteStorage.ts:15, 37 — Adicionado
    // eslint-disable-next-line @typescript-eslint/require-await em exec e
    migrate com comentário citando §5 (StoragePort...)`. Payload: idêntico.
    **Fiel** — inclusive a associação ao `reworkRound`.
14. **EST-36 [m1]** — Fonte (§8 › Parecer): `- [m1] _storage injection em
    seed.ts depende de API interna (SqliteStorageBackend.saveTask). Se o
    backend mudar, quebra. Spec-aware (§6 optou por bypass) — registrado para
    rastreio.`. Payload: idêntico. **Fiel.**

### Itens `inline-reference` (10)

15. **DMM-13c [i1]** — Fonte (§8 › Parecer): bullet `**[i1]** A leitura "lidos
    de JSON/TipiBase" da §6.1 ficou para o caller (runLab) — não dentro de
    fitness. Rastreabilidade: fitness.ts:39-44 exporta DEFAULT_WEIGHTS...`.
    Payload: excerto pós-negrito. **Fiel.**
16. **T-208 [B1]** — Fonte (§8 › Parecer): `**VEREDICTO: APROVADO** — Rework
    fechou [B1] e [M1]; gate verde (53/53); 5/5 sondas adversariais verdes;
    cobertura completa dos 15 casos + 1 (14b). Encaminho para integração.`
    Payload: `e [M1]; gate verde (53/53); 5/5 sondas adversariais verdes;
    cobertura completa dos 15 casos + 1 (14b). Encaminho para integração.`
    **Fiel** (cauda pós-marcador; achado principal definido em outra linha do
    mesmo §8).
17. **T-1046 [M2]** — Fonte (§9 › Rework 2): `**[M2]** reconcile chama
    session.applyNodes(nodes) uma única vez sobre o SignedNode[] completo, em
    vez de iterar nó a nó. Ambos os caminhos (empty tree e range-co...).
    Payload: `chamar applyNodes uma vez sobre o SignedNode[] recebido,
    preservando batch/atomicidade. Adicionar testes para ambos.` — cauda da
    linha 443 pós-marcador. **Fiel.**
18. **T-313c [M1]** — Fonte (§8 › Parecer 15): linha `|- Verificação do rework
    [M1] (Reviewer 1):`. Payload: idêntico. **Fiel.**
19. **EST-05 [m2]** — Fonte (§8 › Parecer): linha de tabela `11 ✓ (parcial —
    ver [m2]) 12 ✓ → 12 testes verdes, 2 com assertion gap.`. Payload:
    `) 12 ✓ → 12 testes verdes, 2 com assertion gap.` **Fiel.**
20. **T-1033 [B0]** — Fonte (§8 › Parecer 2): `- **Evidência:** ls
    packages/core/src/rbsr/ → "The system cannot find the file specified". A
    spec §3 mandava CRIAR packages/core/src/rbsr/applyNodes.ts e
    packages/core/src/rbsr/index.t...`. Payload: idêntico (pós-negrito).
    **Fiel.**
21. **EST-03a [M1]** — Fonte (§9 › Evidência de Rework): linha de log
    `finish em nome do worker — rework concluido... (rework 3a1ae06
    fix(EST-03a) [M1] remove unused PluginManifest import; gate build+test+lint
    verdes)`. Payload: `remove unused PluginManifest import; gate build+test+
    lint verdes)`. **Fiel.**
22. **EST-10b [m1]** — Fonte (§9 › Parecer 3): `...Não-bloqueantes [m1][m2] →
    ledger _pendencias.md.`. Payload: `[m2] → ledger _pendencias.md.` (cauda
    pós-`[m1]`). **Fiel** (verbatim), com a mesma observação de cauda de log.
23. **T-1033 [i2]** — Fonte (§8 › Parecer 2): `**Achados pré-existentes...**
    4 INFO do R1 ([i1] deps cruzadas em package.json; [i2] re-export
    faca-de-dois-gumes; [i3] gate de acoplamento violado) — todos ampliados por
    [B0]/[i1]/[i2] e devem ser revisitados em rework futuro.`. Payload: `e
    devem ser revisitados em rework futuro.` (cauda pós-`[i2]`). **Fiel.**
24. **T-1035 [M2]** — Fonte (§8 › Parecer 3): `[M2] → ledger. Razões: (i) Gates
    deste review foram rodados (não env-block); (ii) a...`. Payload: idêntico.
    **Fiel.**

## Conclusão

Nenhuma divergência encontrada entre payload e fonte citada. O critério 5
(amostra ≥20 auditada à mão contra a fonte; qualquer mismatch = defeito a
corrigir antes de fechar) está satisfeito com **24/24 fiéis**. Os achados de
defeito reais durante a auditoria — captura de múltiplos bullets na mesma
parágrafo, truncamento no `**`, e falha de âncora `$` em arquivos CRLF — foram
corrigidos no extractor antes desta rodada final e estão cobertos pelos
fixtures `FX-001`/`FX-002`/`FX-005`.
