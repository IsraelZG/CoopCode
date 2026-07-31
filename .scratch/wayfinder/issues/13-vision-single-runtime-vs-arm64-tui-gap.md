Type: grilling
Status: open
Blocked by: (none — frontier)

# vision.md diz "OpenCode é o runtime único" e a TUI não roda em ARM64

> Reconstruído em 2026-07-30; corpo original perdido por `git clean -fd`.

## Question

`docs/product/vision.md` fixa o OpenCode como runtime agêntico único. A
decisão 03 provou que a TUI do OpenCode não roda em Windows ARM64, que é a
plataforma número 1 do projeto. As duas afirmações não podem ser ambas
verdadeiras na prática.

O humano precisa escolher: rebaixar a `vision.md` para "runtime preferido onde
a TUI funciona", trocar a prioridade de plataforma, ou aceitar que o OpenCode
entra só por `serve`/SDK e nunca por TUI.

É material de ADR: a decisão muda o que CORE/FLOW/DIST significam.

## Sources

- `docs/product/vision.md`
- Decisões 03 e 04 deste mapa
- `docs/adr/0001-platform-priority.md`
