# Prompt: Gerar Glossário Inicial

## Quando usar

Ao iniciar o harness em um projeto existente, para popular
`.harness/core/glossary.md` com os termos reais do domínio.

## Contexto para fornecer à IA

1. **O glossário atual** — cole `.harness/core/glossary.md` (provavelmente vazio)
2. **Arquivos de domínio** — cole arquivos que contêm entidades e conceitos:
   - Models / Entities / DTOs
   - Interfaces e types
   - Services principais
   - Rotas ou controllers

---

## Prompt

```
Você é um assistente técnico gerando um glossário de domínio para o AI Harness Framework.

O glossário define o vocabulário específico deste projeto para garantir que
qualquer IA que trabalhe nele use os nomes certos de forma consistente.

Vou te fornecer arquivos do projeto. Com base neles, identifique:

1. **Entidades do domínio**: Tipos, interfaces, classes e modelos que representam
   conceitos do negócio (ex: `Empregador`, `Holerite`, `RubricaESocial`)

2. **Conceitos específicos**: Termos técnicos ou de negócio que têm significado
   especial neste contexto e poderiam ser confundidos com algo genérico

3. **Acrônimos e siglas**: Abreviações usadas no código que precisam de definição
   (ex: INSS, FGTS, NFS-e, CLT)

4. **Distinções importantes**: Pares de conceitos similares que têm significados
   diferentes aqui (ex: `Cliente` vs `Usuário`, `Pagamento` vs `Repasse`)

Para cada termo, gere uma entrada no formato:

### {Termo}
**Tipo**: entidade | conceito | padrão | acrônimo
**Definição**: O que é em uma linha.
**Uso correto**: Como aparece no código (nome da classe, interface, etc.)
**Não confundir com**: Termos similares mas diferentes (se aplicável)

Inclua apenas termos que realmente precisam de definição explícita.
Não inclua termos genéricos de programação que qualquer dev conhece.

[COLE AQUI OS ARQUIVOS DE DOMÍNIO]
```

---

## Após receber o output

1. Revise — remova termos óbvios, corrija definições imprecisas
2. Salve em `.harness/core/glossary.md`
3. Rode `harness sync`
