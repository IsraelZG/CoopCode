# Segurança reutilizável no CoopRouter e CoopBruma

## Decisão

Reutilizar os mecanismos já documentados em `Docs/docs`, sem afirmar garantias
que eles não oferecem:

- storage comunitário guarda apenas ciphertext e pode provar retrievability;
- compute determinístico admite verificação probabilística;
- inferência de IA em nó comunitário convencional expõe o plaintext ao
  executor e tem integridade baseada em assinatura, aceitação e reputação;
- autorização, transporte, sandbox e contabilidade reduzem risco, mas não
  transformam um executor hostil em ambiente confidencial.

CoopCode pode instalar CoopRouter, porém `cooprouterd` permanece uma fronteira
de processo. O resultado é **uma experiência de cliente e dois domínios de
confiança**.

```text
CoopCode (repositórios, agentes, segredos)
  │ localhost autenticado / OpenAI-compatible
  ▼
cooprouterd (modelos e recursos concedidos)
  │ conexão somente de saída
  ▼
CoopBruma (admissão, leases, reputação, ledger e liquidação)
  │
  ├─ worker de compute isolado
  └─ worker de storage isolado
```

## Trade-offs do cliente unificado

| Aspecto | Benefício | Custo/risco | Decisão |
|---|---|---|---|
| instalação | uma conta, onboarding e download principal | usuário pode não perceber que virou fornecedor | opt-in explícito e separado para compute e storage |
| adoção da rede | cada instalação da IDE pode adicionar oferta | empresas podem proibir P2P | módulo removível; CoopCode continua funcional |
| implementação | reaproveita UI, updater e detecção do endpoint | acoplamento de releases amplia blast radius | mesmo daemon standalone; contrato local versionado |
| recursos | inventário e modelos servem IDE e rede | disputa por GPU, RAM, energia e temperatura | reserva para trabalho local e limites configuráveis |
| disponibilidade | daemon continua overnight | IDE é aplicação de sessão, não serviço confiável | daemon tem ciclo de vida próprio; serviço fica para fase 24×7 |
| segurança | menos componentes visíveis | payload remoto perto de código e credenciais | processo, sandbox, chaves e diretórios separados |
| desinstalação | experiência simples | apagar a IDE pode destruir custódia contratada | handoff antes de apagar storage; opção de manter Router |
| mercado | CoopCode acelera bootstrap da oferta | limita público a desenvolvedores | CoopRouter continua disponível standalone |

## Aplicação das decisões anteriores

### Identidade, chaves e transporte

Aplicar:

- identidade de dispositivo Ed25519 auto-certificável;
- handshake autenticado e canal cifrado;
- capabilities de curta duração para cada lease;
- token de autorização sem material de chave;
- Key Vault separado, liberando somente a chave e o escopo necessários;
- rotação e revogação de chaves por dispositivo.

No cliente unificado, não compartilhar a chave mestra nem o banco da IDE com o
daemon. A conta pode delegar ao CoopRouter uma chave própria de dispositivo e
capabilities limitadas. Segredos de provedores, repositórios e ferramentas do
CoopCode nunca entram no worker comunitário.

Não copiar literalmente toda a infraestrutura anterior:

- no MVP centralizado, `cooprouterd` mantém TLS 1.3/WebSocket somente de saída
  com CoopBruma e autentica a identidade do dispositivo; Noise/WebRTC entra
  apenas quando houver conexão direta entre peers;
- Ed25519 continua para assinatura, mas eventual Noise usa chave de acordo
  compatível/separada, sem tratar Ed25519 como chave DH;
- “Secure Enclave/Keychain” vira um adapter de plataforma: CNG/DPAPI e hardware
  protegido quando disponível no Windows; keyring/secret service ou cofre
  cifrado no Linux;
- capability assinada, curta e presa ao lease basta no primeiro protocolo.
  UCAN completo só entra quando delegação recursiva entre atores for necessária.

Fontes:

- [`02-cryptographic-lineage-and-auth.md`](../../../Docs/docs/caderno-2-protocol/02-cryptographic-lineage-and-auth.md)
- [`noise-xx.md`](../../../Docs/docs/conceitos/noise-xx.md)
- [`ucan.md`](../../../Docs/docs/conceitos/ucan.md)

### Compute

Reutilizar três sites de execução:

- `local`: na máquina solicitante;
- `trusted`: servidores próprios ou provedores aprovados;
- `community`: máquina de terceiro, somente com consentimento.

A classe de privacidade faz parte do contrato da tarefa. Código-fonte, dados
pessoais, credenciais e contexto privado são inelegíveis para `community` por
padrão. Ausência de site elegível produz erro explícito; não autoriza fallback
silencioso.

O worker comunitário:

- recebe somente modelo, prompt e parâmetros autorizados;
- não recebe tools, filesystem ou credenciais;
- não possui egress por padrão;
- roda com limites de CPU/GPU/RAM/disco, deadline e tamanho de saída;
- assina resultado, revisão do modelo, executor, lease e métricas;
- usa idempotency key, heartbeat e requeue em expiração de lease.

Verificação:

| Trabalho | Verificação aplicável |
|---|---|
| determinístico | reexecução de amostra aleatória e canários |
| storage | desafio-resposta de retrievability |
| banda | recibo assinado pela contraparte |
| IA não determinística | aceitação do solicitante, amostragem redundante e reputação |

Para IA, pagamento remunera recurso/tempo entregue sob o contrato, não uma
“prova criptográfica de resposta correta”. O desenho anterior descartou
TEE/TPM e adotou detecção pós-fato. Portanto, compute confidencial com atestação
é uma classe futura e opcional, nunca requisito ou promessa do MVP.

Fontes:

- [`12-plugins-e-computacao.md`](../../../Docs/docs/caderno-3-sdk/12-plugins-e-computacao.md)
- [`14-ia-rag-e-agentes.md`](../../../Docs/docs/caderno-3-sdk/14-ia-rag-e-agentes.md)
- [`classe-de-privacidade.md`](../../../Docs/docs/conceitos/classe-de-privacidade.md)
- [`contribuicao-verificavel.md`](../../../Docs/docs/conceitos/contribuicao-verificavel.md)
- [`desafio-canary.md`](../../../Docs/docs/conceitos/desafio-canary.md)

### Storage

Aplicar diretamente:

- cifragem no cliente com AES-256-GCM antes do upload;
- chunks e manifests endereçados pelo hash do ciphertext;
- chave fora do manifest, liberada pelo Key Vault após autorização;
- modo `unique` como padrão comunitário, sem deduplicação e sem ataque de
  confirmação de arquivo;
- custódia cega: o fornecedor armazena ciphertext sem aprender conteúdo,
  autoria ou chaves;
- replicação inicial `N >= 3`, consistent hashing, health-check e handoff
  `RELEASE/ACK` antes de remover uma cópia;
- desafio aleatório sobre byte ranges para provar retrievability;
- quotas por identidade/escopo, reputação e caução para papéis de custódia.

O modo convergente troca privacidade por deduplicação e fica restrito a
domínios administrados/mesma conta. Erasure coding é uma otimização posterior:
replicação três vezes é o primeiro mecanismo já especificado e verificável.

Limites que permanecem:

- tamanho, horário, contraparte e padrão de acesso vazam metadados;
- custódia cega não identifica spam ou conteúdo ilegal;
- quem já recebeu plaintext ou chave não pode ser obrigado
  criptograficamente a “desver”;
- exclusão depende de handoff, expiração e cooperação auditável dos nós.

Fontes:

- [`05-media-transport-plane.md`](../../../Docs/docs/caderno-3-sdk/05-media-transport-plane.md)
- [`custodia-cega-archive.md`](../../../Docs/docs/conceitos/custodia-cega-archive.md)
- [`convergent-encryption.md`](../../../Docs/docs/conceitos/convergent-encryption.md)
- [`private-swarm.md`](../../../Docs/docs/conceitos/private-swarm.md)

### Economia, fraude e Sybil

CoopRouter mede e assina fatos de execução. CoopBruma decide preço, saldo e
liquidação. Não remunerar “quantidade de requisições”, mas unidades verificadas
de recurso, duração, modelo e resultado do lease.

Contribuição só ganha peso ao servir contrapartes distintas e reputadas.
Identidade auto-certificável impede spoofing, não Sybil. Para um serviço
comercial, admissão/KYC resolve Sybil na entrada; reputação, diversidade,
canários e caução tratam fraude operacional. Créditos internos precedem saque.

Fontes:

- [`defesa-sybil.md`](../../../Docs/docs/conceitos/defesa-sybil.md)
- [`bond-caucao.md`](../../../Docs/docs/conceitos/bond-caucao.md)
- [`credits.md`](../../../Docs/docs/conceitos/credits.md)

## Ordem mínima de implementação

1. Isolar `cooprouterd` do CoopCode e autenticar o endpoint localhost.
2. Delegar uma identidade própria ao daemon; nenhuma chave/credencial da IDE.
3. Implementar classes `local`, `trusted` e `community` com política fail-closed.
4. Validar leases, idempotência, assinatura de resultado e accounting sem dinheiro.
5. Liberar compute da mesma conta; depois comunidade com créditos fechados.
6. Implementar storage da mesma conta em modo `unique`, replicação `N=3` e
   desafios de retrievability.
7. Somente depois abrir compute/storage comunitário e remuneração.

Ficam fora do MVP: TEE/TPM, FHE/MPC, erasure coding, dinheiro sacável,
serviço 24×7 sem sessão e deduplicação convergente comunitária.
