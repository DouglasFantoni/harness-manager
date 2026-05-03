# Prompt: Gerar Regras Iniciais

## Quando usar

Para popular `.harness/core/rules.md` com regras reais derivadas
dos padrões e convenções que já existem no projeto.

## Contexto para fornecer à IA

1. **O rules.md atual** — cole `.harness/core/rules.md`
2. **Configurações de qualidade** — cole o conteúdo de:
   - `.eslintrc` / `eslint.config.*`
   - `tsconfig.json`
   - `.prettierrc`
   - `jest.config.*` / `vitest.config.*`
3. **Exemplos de código** — cole 2-3 arquivos que representam bem
   os padrões do projeto (um service, um controller, um teste)
4. **PRs ou commits relevantes** — se houver mensagens de PR que
   discutem padrões, cole também

---

## Prompt

```
Você é um assistente técnico gerando as regras de projeto para o AI Harness Framework.

As regras são restrições inegociáveis que qualquer IA deve seguir ao trabalhar
neste projeto. Elas derivam das convenções reais do codebase — não de boas
práticas genéricas.

Vou te fornecer configurações e exemplos de código do projeto.

Com base neles, gere regras nas seguintes categorias:

**Qualidade de código**
Regras derivadas do tsconfig, eslint e exemplos. Ex: "Nunca usar `any`",
"Sempre tipar o retorno de funções públicas", "Imports absolutos apenas"

**Escopo de mudanças**
Como mudanças devem ser feitas. Ex: "Não refatorar código não relacionado
à task pedida", "Migrations sempre em arquivo separado"

**Validação**
O que rodar antes de considerar algo pronto. Derive dos scripts disponíveis.
Ex: "Sempre rodar typecheck antes de finalizar", "Testes devem passar"

**Padrões de nomenclatura**
Se encontrar convenções claras no código. Ex: "Services terminam em Service",
"DTOs terminam em Dto", "Interfaces não usam prefixo I"

**O que nunca fazer**
Anti-padrões encontrados nas configs ou comentários do código.

Formato de cada regra: uma linha imperativa e direta.
Agrupe por categoria com um título `##`.
Não inclua regras genéricas que qualquer projeto seguiria.
Foque no que é específico ou importante para ESTE projeto.

[COLE AQUI O rules.md ATUAL]

[COLE AQUI AS CONFIGS DE QUALIDADE]

[COLE AQUI EXEMPLOS DE CÓDIGO]
```

---

## Após receber o output

1. Revise — remova regras óbvias, ajuste as imprecisas
2. Salve em `.harness/core/rules.md`
3. Rode `harness sync`
