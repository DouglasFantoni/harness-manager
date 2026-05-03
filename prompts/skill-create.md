# Prompt: Criar uma nova Skill

## Quando usar

Quando quiser criar uma skill para um domínio específico do projeto
(ex: pagamentos, autenticação, emissão fiscal, integração com API externa).

## Contexto para fornecer à IA

1. **O template de skill** — cole o conteúdo de `.harness/skills/_template/SKILL.md`
2. **Os arquivos do domínio** — cole o conteúdo dos principais arquivos
   relacionados ao domínio que a skill vai cobrir
3. **Erros já conhecidos** — se houver entradas relevantes em
   `.harness/memory/mistakes.md`, cole também

---

## Prompt

```
Você é um assistente técnico criando uma skill para o AI Harness Framework.

Uma skill é um arquivo Markdown que encapsula o conhecimento especializado
de um domínio do projeto para guiar IAs que vão trabalhar nesse domínio.

Vou te fornecer:
- O template de skill (com instruções em cada campo)
- Os arquivos do domínio que a skill deve cobrir
- Erros conhecidos relacionados (se houver)

Com base nesses arquivos, gere uma skill completa para o domínio: **[NOME DO DOMÍNIO]**

Diretrizes para cada campo:

- **Quando usar**: Seja específico. Quais tipos de arquivo ou task disparam esta skill?
- **Quando NÃO usar**: Quais situações parecidas mas diferentes NÃO devem usar esta skill?
- **Contexto essencial**: Seja cirúrgico — cada linha custa tokens toda vez que a skill
  é carregada. Inclua apenas o que a IA realmente precisa saber para não errar.
- **Regras**: Use linguagem imperativa. "Sempre X", "Nunca Y", "Antes de Z, faça W".
  Derive das convenções que você encontrar nos arquivos fornecidos.
- **Padrões**: Como as coisas são feitas neste domínio. Referencie exemplos ao invés
  de repetir código inline.
- **Checklist**: O que verificar antes de considerar uma task deste domínio concluída.
- **weight**: Estime os tokens que esta skill ocupa quando carregada (~palavras × 1.3)

Formato de saída: o SKILL.md preenchido, sem comentários adicionais.

[COLE AQUI O TEMPLATE .harness/skills/_template/SKILL.md]

[COLE AQUI OS ARQUIVOS DO DOMÍNIO]

[COLE AQUI ERROS CONHECIDOS RELACIONADOS — SE HOUVER]
```

---

## Após receber o output

1. Salve em `.harness/skills/{domain}/SKILL.md`
2. Adicione uma linha em `.harness/skills/_index.md`
3. Rode `harness sync`
