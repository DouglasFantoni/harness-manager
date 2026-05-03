# Prompts

Esta pasta contém prompts prontos para usar com qualquer ferramenta de IA.

O AI Harness não faz chamadas de IA diretamente — em vez disso, fornece prompts
que você copia e cola na IA que já usa (Claude, ChatGPT, Cursor, etc.).

## Quando usar cada prompt

| Prompt | Quando usar |
|--------|-------------|
| [`init-enrich.md`](./init-enrich.md) | Logo após rodar `harness init` — para enriquecer o que o detector automático não conseguiu preencher |
| [`skill-create.md`](./skill-create.md) | Quando quiser criar uma nova skill para um domínio do projeto |
| [`glossary-generate.md`](./glossary-generate.md) | Para gerar um glossário inicial a partir do código existente |
| [`rules-generate.md`](./rules-generate.md) | Para gerar as regras iniciais do projeto com base nos padrões encontrados |
| [`mistakes-extract.md`](./mistakes-extract.md) | Para extrair armadilhas conhecidas de PRs, commits ou discussões passadas |

## Como usar

1. Abra o prompt correspondente
2. Siga as instruções de contexto — o prompt indica quais arquivos anexar ou colar
3. Cole o prompt + contexto na sua IA
4. Revise o output gerado antes de salvar em `.harness/`
5. Rode `harness sync` para regenerar os adapters

## Filosofia

Os prompts são a ponte entre o harness e a IA — mas a IA não tem acesso direto
ao projeto. Você controla o que ela vê e aprova o que ela sugere.
