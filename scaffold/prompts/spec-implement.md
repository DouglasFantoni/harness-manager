# Prompt: Implementar a partir de uma Spec

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Cole os arquivos indicados antes de enviar.

---

Você é um assistente técnico implementando uma feature no projeto
**{{project.name}}** ({{project.type}}, stack: {{harness.stack_summary}}).

## Spec da feature

Cole aqui o conteúdo de `.harness/specs/{feature}/spec.md`:

```markdown
[COLE AQUI A SPEC]
```

## Contexto existente

Cole aqui os arquivos relevantes já existentes no projeto
(models, services, controllers, rotas relacionadas):

```
[COLE AQUI OS ARQUIVOS EXISTENTES]
```

## O que preciso

Implemente as user stories indicadas abaixo seguindo **estritamente** os
critérios de aceite da spec. Para cada critério de aceite:

- Escreva o código que o satisfaz
- Escreva o(s) teste(s) que o verificam
- Use o nome do critério como descrição do teste (`it('...')`)

Stories a implementar: **[liste as US que quer implementar, ex: US-01, US-02]**

## Regras obrigatórias

- Não implemente comportamento não descrito na spec sem perguntar
- Se encontrar ambiguidade em um critério, liste as interpretações e pergunte
  antes de implementar
- Não implemente stories com `status: draft` — me avise se encontrar
- Testes devem cobrir caminho feliz, edge cases e erros esperados
  conforme os critérios
- Use os comandos de validação após implementar:
  - Typecheck: `{{commands.typecheck}}`
  - Testes: `{{commands.test}}`

## O que fazer com o output

1. Revise o código gerado
2. Marque os critérios implementados como `- [x]` na spec
3. Atualize `status` da spec para `in-progress` ou `done` conforme o caso
4. Rode `/spec-check --feature {nome}` para confirmar cobertura
5. Rode `{{commands.typecheck}}` e `{{commands.test}}`
