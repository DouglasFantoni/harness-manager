# Prompt: Gerar Glossário

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Cole os arquivos indicados antes de enviar.

---

Você é um assistente técnico gerando o glossário de domínio para o projeto
**{{project.name}}** usando o AI Harness Framework.

## Glossário atual

```markdown
{{harness.glossary}}
```

## O que preciso

Analise os arquivos de domínio abaixo e identifique termos que precisam
de definição explícita para qualquer IA que trabalhe neste projeto.

Cole aqui os arquivos de domínio (models, entities, DTOs, interfaces, types):

```
[COLE AQUI OS ARQUIVOS DE DOMÍNIO]
```

## Tipos de termos para identificar

- **Entidades do domínio**: Classes, interfaces e tipos que representam conceitos do negócio
- **Conceitos específicos**: Termos com significado especial neste contexto
- **Acrônimos e siglas**: Abreviações usadas no código que precisam de definição
- **Distinções importantes**: Pares de conceitos similares com significados diferentes aqui

## Formato de cada entrada

```markdown
### {Termo}
**Tipo**: entidade | conceito | padrão | acrônimo
**Definição**: O que é em uma linha.
**Uso correto**: Como aparece no código (nome da classe, interface, etc.)
**Não confundir com**: Termos similares mas diferentes (se aplicável)
```

Não inclua termos genéricos de programação. Foque no vocabulário específico
deste projeto. Retorne apenas o Markdown das entradas, sem texto adicional.

## O que fazer com o output

1. Revise — remova termos óbvios, corrija definições imprecisas
2. Adicione ao final de `.harness/core/glossary.md`
3. Rode: `{{commands.sync}}`
