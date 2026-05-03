# Prompt: Condensar Memória do Projeto

> Copie tudo abaixo desta linha e cole na sua IA preferida.
> Use quando os arquivos de memory estiverem grandes e lentos para carregar.

---

Você é um assistente técnico condensando a memória do AI Harness Framework
no projeto **{{project.name}}**.

Com o tempo, os arquivos de memória acumulam entradas e ficam pesados.
Seu trabalho é condensar sem perder informação crítica.

## mistakes.md atual

```markdown
{{harness.mistakes}}
```

## patterns.md atual

```markdown
{{harness.patterns}}
```

## decisions.md atual

```markdown
{{harness.decisions}}
```

## O que preciso

Para cada arquivo, gere uma versão condensada seguindo estas regras:

### mistakes.md
- Agrupe erros similares em uma única entrada mais rica
- Remova entradas cuja solução já foi incorporada como regra em `core/rules.md`
  (são redundantes — a regra já previne o erro)
- Mantenha entradas de erros sutis que regras não cobrem
- Mantenha formato: `## [YYYY-MM] {Título}` com Problema/Causa raiz/Solução

### patterns.md
- Agrupe padrões do mesmo domínio
- Remova padrões que já são óbvios dado o stack atual do projeto
- Mantenha padrões não-óbvios e específicos do projeto

### decisions.md
- **Nunca remova ADRs** — são registro histórico imutável
- Apenas adicione um resumo executivo no topo de cada ADR longa
  (máx 2 linhas antes do ## Contexto)

**Regras gerais:**
- Objetivo: reduzir em 30-50% sem perder informação acionável
- Se em dúvida entre manter ou remover, mantenha
- Não invente informação nova
- Mantenha o mesmo formato Markdown

Retorne os três arquivos separados por `---FILE: {nome}---`

## O que fazer com o output

1. Revise cada arquivo antes de aplicar
2. Faça backup dos originais: `cp .harness/memory/mistakes.md .harness/memory/mistakes.bak.md`
3. Substitua os arquivos com as versões condensadas
4. Rode `harness sync`
5. Remova os backups quando confirmar que está correto
