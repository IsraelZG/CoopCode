# CoopCode, CoopRouter e CoopBruma — limites de produto

## Decisão recomendada

A arquitetura é viável com **uma experiência principal de instalação**, um
produto standalone e um serviço de rede, mantendo contratos explícitos:

1. **CoopCode** é a IDE e coordena tarefas/agentes.
2. **CoopRouter** é um módulo opcional instalado com CoopCode e também um
   produto standalone; oferece inferência local, participação opt-in na rede e,
   futuramente, armazenamento opt-in.
3. **CoopBruma** autentica, agenda, contabiliza e liquida o mercado da rede.

O endpoint OpenAI-compatible é o único contrato obrigatório entre CoopCode e
CoopRouter. CoopCode não deve conhecer LocalAI, Colibri, Cactus, modelos,
hardware, recompensas ou armazenamento.

```text
CoopCode ── OpenAI-compatible HTTP ──► CoopRouter local
   │                                      │
   │ provider direto continua válido      ├─ LocalAI adapter
   │                                      ├─ Colibri adapter
   └──────────────────────────────────────┼─ outros adapters
                                          │
                               conexão de saída autenticada
                                          │
                                          ▼
                                      CoopBruma
                         scheduler · policy · ledger · billing
```

É um **Go** para a experiência integrada com isolamento interno e para um
primeiro CoopRouter local. É um
**No-Go no mesmo MVP** para misturar rede remunerada e armazenamento público:
cada um introduz segurança, fraude, privacidade e obrigações legais próprias.

## Um cliente para o usuário, dois limites de execução

Devem existir dois downloads:

- `CoopCode-Setup-<versão>-<plataforma>` — instala a IDE e oferece o módulo
  CoopRouter, selecionado por padrão, mas com consentimentos separados para
  inferência local, compute comunitário e storage;
- `CoopRouter-Setup-<versão>-<plataforma>` — instala o mesmo daemon e uma tray
  fina, sem a IDE.

Não existe uma terceira implementação nem um bootstrapper Coop Suite.
`cooprouterd` é o mesmo artefato nos dois pacotes. Quando instalado pelo
CoopCode, a IDE é sua superfície de controle e nenhuma segunda tray precisa
ficar aberta. Quando instalado sozinho, CoopRouter fornece a tray.

Mesmo no pacote unificado, IDE e daemon continuam separados em:

- executáveis e processos;
- diretórios, bancos, logs e chaves de serviço;
- permissões de filesystem/rede e sandbox;
- falhas, restart e retenção de dados;
- consentimentos e telemetria.

CoopCode apenas detecta o endpoint local, mostra o estado e oferece
“Abrir CoopRouter”. Se o Router não estiver instalado ou estiver parado, a IDE
continua usando provedores configurados diretamente no OpenCode.

Fechar ou atualizar a IDE não encerra leases aceitos nem torna fragmentos
indisponíveis. Ao desinstalar CoopCode, o usuário escolhe entre manter
CoopRouter, remover somente o daemon ou também apagar seus dados após handoff
seguro do storage.

## Propriedade de cada decisão

| Decisão | Proprietário |
|---|---|
| tarefa, agente, privacidade e orçamento do projeto | CoopCode |
| modelo requerido e capacidades mínimas | CoopCode |
| engine local, variante do modelo e uso de CPU/GPU/RAM | CoopRouter |
| health, downloads e ciclo de vida dos runtimes locais | CoopRouter |
| escolha entre nó comunitário, servidor próprio e provedor externo | CoopBruma |
| admissão de nós, reputação, fraude, preço e liquidação | CoopBruma |
| armazenamento, criptografia, replicação e auditoria de fragmentos | plano de storage |

CoopCode pode enviar restrições como `privacy=local-only`,
`privacy=trusted-cloud` ou `privacy=community`, mas não implementa o roteamento
que satisfaz essas restrições.

## Processo local recomendado

Electron deve permanecer interface e supervisor leve. Os workloads não devem
rodar dentro do processo principal:

```text
CoopCode UI ou CoopRouter tray
  └─ cooprouterd (mesmo binário)
      ├─ inference supervisor
      │   ├─ LocalAI
      │   ├─ Colibri
      │   └─ outros adapters
      ├─ cloud node client (opt-in)
      └─ storage worker (futuro e opt-in separado)
```

No primeiro produto, `cooprouterd` pode ser um processo por usuário iniciado
com a sessão. Isso implica que o nó só recebe trabalho enquanto o usuário está
logado. Quando houver remuneração ou storage 24×7, serviço Windows/systemd deve
ser reavaliado: disponibilidade deixa de ser apenas conveniência da tray.

Nenhuma porta de entrada deve ser aberta no roteador doméstico. O nó mantém uma
conexão de saída com CoopBruma, usando identidade própria, leases, deadlines,
cancelamento e streaming.

## Papel dos projetos avaliados

### LocalAI

É o melhor candidato a engine padrão: licença MIT, API OpenAI-compatible,
backends instaláveis sob demanda e cobertura ampla de hardware/modelos.

LocalAI já possui:

- P2P federado, apropriado a experimentos e compartilhamento comunitário;
- modo distribuído com frontend, workers, PostgreSQL, NATS e SmartRouter;
- instalação dinâmica de backends e scheduling por capacidade.

Portanto, CoopRouter não deve reconstruir outro scheduler **local** por cima
dele. Entretanto, esses modos não resolvem sozinhos um mercado público hostil:
faltam contrato comercial da tarefa, privacidade por classe, prova de execução,
reputação, antifraude e liquidação. CoopBruma continua sendo necessário.

Decisão: integrar LocalAI como primeiro adapter/runtime, inicialmente
local-only. Avaliar o protocolo distribuído como implementação interna apenas
depois que o contrato CoopBruma↔nó estiver definido.

### OmniRoute

OmniRoute é um gateway MIT de provedores, com endpoint OpenAI-compatible,
fallback, quotas, dashboard e integração com OpenCode. Há sobreposição com o
gateway local e com parte do routing de CoopBruma.

Decisão:

- não incluir OmniRoute no CoopCode;
- não torná-lo o supervisor central do CoopRouter;
- avaliar depois um adapter opcional para credenciais e fallback entre
  provedores externos;
- manter scheduler de nós, preços e liquidação exclusivamente no CoopBruma.

O MVP local não precisa dele: LocalAI já fornece o plano de engines e CoopCode
já fala OpenAI-compatible. Adicioná-lo agora criaria dois catálogos de modelos,
duas políticas de fallback e duas dashboards.

### Colibri

Colibri é Apache-2.0 e oferece uma API OpenAI-compatible especializada em
modelos MoE enormes, fazendo streaming de experts entre disco, RAM e VRAM.
Isso o torna um adapter valioso para máquinas com muito armazenamento, mas não
um runtime geral. O próprio baseline de 25 GB é extremamente lento e o modelo
de referência ocupa centenas de GB.

Decisão: adapter experimental depois do runtime padrão, ativado somente quando
o inventário de hardware e um benchmark local atingirem o SLA anunciado ao
CoopBruma.

### Cactus

Cactus é orientado a mobile/edge. Sua licença atual permite uso gratuito apenas
nas categorias e limites descritos no arquivo de licença; organizações acima
de US$ 2 milhões de funding **ou** receita precisam de licença comercial.

Decisão: não embutir nem depender dele no MVP desktop. Abrir avaliação técnica
e comercial separada antes de qualquer distribuição. Ele pode se tornar um
adapter para nós móveis, não a base de Windows/Linux.

### Modelos Prism ML

Modelos são catálogo, não código do instalador. As variantes Bonsai 27B
inspecionadas declaram Apache-2.0 e formatos GGUF pequenos, mas a licença e os
artefatos devem ser validados **por modelo e revisão**.

Decisão:

- baixar modelos depois da instalação;
- fixar repositório, revisão, arquivos e hashes;
- guardar licença, notices, requisitos e proveniência no catálogo;
- exigir aceite quando a licença do modelo pedir;
- nunca assumir que toda uma coleção possui a mesma licença.

## Rede remunerada

### Privacidade

TLS protege o tráfego, mas o worker precisa ver o prompt para executar
inferência convencional. Não devemos prometer criptografia ponta a ponta contra
o próprio nó executor.

Classes mínimas:

- `local-only`: nunca sai da máquina;
- `trusted-cloud`: somente servidores próprios ou provedores aprovados;
- `community`: pode ir a um nó de terceiro, com aviso explícito.

Código-fonte, segredos e contexto privado do CoopCode devem usar `local-only` ou
`trusted-cloud` por padrão. A rede comunitária fica desligada para esse conteúdo
até que o usuário escolha o contrário.

O worker comunitário recebe somente payload de modelo: sem tools, filesystem,
credenciais ou egress de rede por padrão. Cada runtime roda isolado, com limites
de CPU/GPU/RAM/disco, tempo e tamanho de saída.

### Contabilidade e fraude

“Número de requisições” não é unidade suficiente. Uma requisição pode custar
milhares de vezes outra. O ledger deve registrar, no mínimo:

- modelo e revisão;
- tokens de entrada/saída ou unidade equivalente;
- duração, latência e streaming;
- classe de hardware e energia quando verificável;
- resultado do lease e qualidade amostrada.

Hash da resposta não prova execução correta. O desenho precisa de reputação,
canários, duplicação amostral e desafios verificáveis. O lançamento deve usar
**créditos internos não sacáveis** antes de dinheiro: pagamentos trazem KYC,
tributação, fraude, chargebacks e regras diferentes por país.

## Armazenamento compartilhado

Armazenamento não deve reutilizar a API ou a fila de inferência. Pode aparecer
na mesma tray, mas precisa de protocolo, worker, quotas, consentimento e ledger
separados.

Requisitos mínimos antes de armazenar conteúdo de terceiros:

- criptografia no cliente; o nó guarda apenas fragmentos cifrados;
- endereçamento por conteúdo, hashes e auditorias periódicas;
- erasure coding/replicação e reparo após nós offline;
- limites de disco, banda, desgaste e horário definidos pelo dono;
- rotação de chaves, exclusão, retenção e recuperação;
- tratamento jurídico de conteúdo ilegal, abuso e ordens de remoção.

Primeiro passo seguro: sincronização entre máquinas da mesma conta. O mercado
público de storage deve ser uma trilha posterior e independente da rede de
inferência.

## Repositórios

```text
coopcode/       IDE, coordinator e workers de desenvolvimento
cooprouter/     tray, daemon local, adapters e API local
coopbruma/      gateway público, scheduler, policy, ledger e billing
coop-protocol/  schemas gerados compartilhados, somente quando houver 2 consumidores
```

Não copiar os quatro upstreams para um monorepo. Primeiro pinamos versões e
integramos por adapters/processos. Fazemos fork apenas dos projetos realmente
adotados e somente quando existir uma alteração nossa a manter. Cada release
gera SBOM e notices das engines/modelos instalados.

“Fork uma vez” pode definir a linhagem inicial, mas não deve significar ignorar
correções de segurança para sempre. Cada fork adotado registra commit-base,
licença e uma fila explícita de patches upstream a avaliar. Fazer fork não
remove obrigações de licença — em especial, não transforma Cactus em software
comercialmente irrestrito.

## Sequência de entrega

1. **Router local:** tray + daemon + LocalAI + um modelo Prism validado; endpoint
   local; sem conta, rede ou remuneração.
2. **Bruma da própria conta:** CoopBruma encaminha para máquinas pertencentes
   ao mesmo usuário; valida NAT, leases, streaming e observabilidade.
3. **Rede comunitária por créditos:** opt-in, payloads não sensíveis, nós
   aprovados, reputation/antifraude e servidores próprios como fallback.
4. **Liquidação financeira:** somente após revisão jurídica, fiscal e de
   pagamentos.
5. **Storage próprio:** sincronização cifrada entre dispositivos da conta.
6. **Storage comunitário:** somente após auditoria específica de segurança,
   recuperação, abuso e economia.

## Próximas decisões verificáveis

- Definir o contrato `CoopCode → OpenAI-compatible endpoint`, incluindo classes
  de privacidade e fallback.
- Fazer um spike local de LocalAI em Windows ARM64 e medir instalação, modelo,
  health, geração e encerramento.
- Definir o protocolo `CoopBruma ↔ cooprouterd` antes de reutilizar o modo
  distribuído do LocalAI.
- Produzir matriz de licenças por engine e modelo; Cactus permanece bloqueado
  até decisão comercial.
- Prototipar o módulo CoopRouter no instalador CoopCode reutilizando exatamente
  o mesmo `cooprouterd` distribuído pelo instalador standalone.

## Fontes primárias consultadas

- LocalAI: <https://github.com/mudler/LocalAI>
- LocalAI P2P: <https://localai.io/features/distribute/>
- LocalAI Distributed Mode: <https://localai.io/features/distributed-mode/>
- OmniRoute: <https://github.com/diegosouzapw/OmniRoute>
- Colibri: <https://github.com/JustVugg/colibri>
- Cactus: <https://github.com/cactus-compute/cactus>
- Licença do Cactus: <https://github.com/cactus-compute/cactus/blob/main/LICENSE>
- Prism ML: <https://huggingface.co/prism-ml/collections>
