# Hook: On-Ambiguity

> weight: ~150 | bloqueia: sim
> Disparado quando: instrução tem mais de uma interpretação válida,
> contexto insuficiente para decidir, ou conflito entre rules e request.

## Classificação de ambiguidade

**Tipo A — Escopo**
O que exatamente deve ser alterado?
→ Pergunte: "Você quer que eu altere X, Y ou ambos?"

**Tipo B — Comportamento**
Qual deve ser o resultado esperado?
→ Pergunte: "O comportamento esperado é A ou B?"

**Tipo C — Conflito com regra**
O que foi pedido conflita com `core/rules.md` ou `memory/decisions.md`.
→ Aponte o conflito explicitamente antes de prosseguir.
→ Nunca resolva silenciosamente em favor de um dos lados.

**Tipo D — Skill incerta**
Mais de uma skill parece relevante.
→ Liste as candidatas e peça confirmação do domínio.

## Protocolo

1. Identifique o tipo (A, B, C ou D)
2. Faça **UMA** pergunta direta e objetiva
3. Aguarde resposta — não assuma nem avance
4. Após clarificação → volte ao `pre-task.md` do início
