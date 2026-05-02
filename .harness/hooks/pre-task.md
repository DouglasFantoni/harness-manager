# Hook: Pre-Task

> weight: ~300 | bloqueia: sim
> Executar antes de qualquer task. Só avance quando todos os itens estiverem ✅.

## 1. Clareza de escopo

- [ ] Entendi o que foi pedido?
- [ ] Se não → `hooks/on-ambiguity.md` agora, antes de qualquer outra coisa

## 2. Skill relevante

- [ ] Consultei `skills/_index.md`?
- [ ] Identifiquei o domínio do arquivo ou task?
- [ ] A soma dos pesos das skills a carregar está dentro de 40% do `context_tokens_est`?

## 3. Memória do domínio

- [ ] Verifiquei `memory/mistakes.md` para armadilhas conhecidas neste domínio?
- [ ] Existe alguma decisão em `memory/decisions.md` que afeta esta task?

## 4. Plano declarado

Antes de executar, escreva em 2–3 linhas:
- O que vai fazer
- Quais arquivos serão tocados
- Qual o critério de sucesso

> Se o plano tocar mais de 3 arquivos não relacionados → questione o escopo antes de prosseguir.

## 5. Comandos de projeto disponíveis

Os comandos do projeto estão em `project-details.json`.
- Rode o subconjunto relevante ao final da task
- `typecheck` é obrigatório em qualquer task que altere código TypeScript
- Nunca assuma que o código está correto sem rodar ao menos typecheck
