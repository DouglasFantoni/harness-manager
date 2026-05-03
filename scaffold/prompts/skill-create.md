# Prompt: Criar nova Skill

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Substitua [DOMÍNIO] pelo domínio que quer cobrir e cole os arquivos indicados.

---

Você é um assistente técnico criando uma skill para o AI Harness Framework
no projeto **{{project.name}}**.

## Template de skill

```markdown
{{harness.skill_template}}
```

## O que preciso

Gere uma skill completa para o domínio: **[DOMÍNIO]**

Cole abaixo os arquivos do domínio que a skill deve cobrir
(models, services, DTOs, interfaces relacionadas):

```
[COLE AQUI OS ARQUIVOS DO DOMÍNIO]
```

Se houver erros conhecidos relacionados, cole também o trecho relevante
de `.harness/memory/mistakes.md`.

## Diretrizes

- **`Quando usar`**: Quais arquivos ou tasks disparam esta skill? Seja específico.
- **`Quando NÃO usar`**: Quais situações parecidas mas diferentes não usam esta skill?
- **`Contexto essencial`**: Apenas o que a IA realmente precisa saber para não errar.
  Cada linha custa tokens toda vez que a skill é carregada.
- **`Regras`**: Linguagem imperativa. "Sempre X", "Nunca Y", "Antes de Z, faça W".
- **`Padrões`**: Como as coisas são feitas aqui. Referencie exemplos ao invés de repetir código.
- **`weight`**: Estime ~(número de palavras × 1.3)

Retorne apenas o SKILL.md preenchido, sem texto adicional.

## O que fazer com o output

1. Salve em `.harness/skills/[dominio]/SKILL.md`
2. Adicione uma linha em `.harness/skills/_index.md`
3. Rode: `{{commands.sync}}`
