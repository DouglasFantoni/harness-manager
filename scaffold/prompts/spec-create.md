# Prompt: Criar uma Spec a partir de uma Ideia

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Substitua [IDEIA] pela descrição da feature que quer especificar.

---

Você é um assistente técnico criando uma spec de feature para o projeto
**{{project.name}}**.

## Glossário do projeto

```markdown
{{harness.glossary}}
```

## Template de spec

```markdown
{{harness.spec_template}}
```

## Feature a especificar

**Ideia:** [IDEIA — descreva a feature em linguagem natural, sem se preocupar com formato]

Se disponível, cole contexto adicional abaixo (screenshots, conversas, tickets):

```
[CONTEXTO ADICIONAL — OPCIONAL]
```

## O que preciso

Gere uma spec completa para esta feature seguindo o template acima.

**Diretrizes:**

- **Contexto**: explique o problema de negócio, não a solução técnica
- **User Stories**: cada story deve ser independente, testável e entregável sozinha
- **Critérios de aceite**: use linguagem observável e verificável.
  Ruim: "sistema funciona corretamente"
  Bom: "confirmação duplicada retorna o estado atual sem erro 409"
- **Fora de escopo**: seja explícito sobre o que NÃO faz parte desta spec
- **Regras de negócio**: capture as invariantes que cruzam stories
- **Use o vocabulário do glossário** para nomear entidades e conceitos

Use `status: draft` — a spec será revisada antes de implementar.

Gere um `id` sequencial baseado nas specs existentes em `specs/_index.md`
(se não souber o último, use `feat-001`).

Retorne apenas o Markdown da spec, sem texto adicional.

## O que fazer com o output

1. Salve em `.harness/specs/{feature}/spec.md`
2. Adicione uma linha em `.harness/specs/_index.md`
3. Revise com o time antes de mudar `status` para `ready`
4. Quando `ready`, use `harness prompt spec-implement` para implementar
