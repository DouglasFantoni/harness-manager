# Prompt: Gerar Regras do Projeto

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Cole os arquivos indicados antes de enviar.

---

Você é um assistente técnico gerando as regras de projeto para o AI Harness
Framework no projeto **{{project.name}}**.

As regras de interação com o harness (hooks, evolução, comportamento da IA)
já estão em `HARNESS.md`. O objetivo aqui é gerar **somente regras derivadas
do projeto**: qualidade de código, escopo, validação, nomenclatura.

## Regras atuais do projeto

```markdown
{{harness.rules}}
```

## Stack do projeto

{{harness.stack_summary}}

## O que preciso

Analise os arquivos abaixo e gere regras derivadas das convenções reais
deste projeto — não boas práticas genéricas.

Cole aqui as configurações de qualidade do projeto:
- `tsconfig.json`
- `.eslintrc` / `eslint.config.*`
- `.prettierrc` (se existir)
- `jest.config.*` / `vitest.config.*` (se existir)

```
[COLE AQUI AS CONFIGS DE QUALIDADE]
```

Cole aqui 2-3 arquivos que representam bem os padrões do projeto
(um service, um controller ou handler, um teste):

```
[COLE AQUI OS EXEMPLOS DE CÓDIGO]
```

## Categorias de regras

Gere regras nas seguintes categorias (apenas as que tiverem base nos arquivos):

- **Qualidade de código**: Derivadas do tsconfig e eslint
- **Escopo de mudanças**: Como e o que pode ser alterado por task
- **Validação**: O que rodar antes de considerar algo pronto
  (use os comandos: {{commands.typecheck}}, {{commands.lint}}, {{commands.test}})
- **Nomenclatura**: Convenções de nomes encontradas no código
- **O que nunca fazer**: Anti-padrões evidentes nas configs

Cada regra deve ser uma linha imperativa e direta.
Retorne apenas o Markdown com as seções, sem texto adicional.

## O que fazer com o output

1. Revise — remova regras óbvias, ajuste as imprecisas
2. Substitua o conteúdo de `.harness/core/rules.md`
3. Rode: `{{commands.sync}}`
