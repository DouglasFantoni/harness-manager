# Prompt: Extrair Armadilhas do Histórico

## Quando usar

Para popular `.harness/memory/mistakes.md` com erros reais que já aconteceram,
extraídos de PRs, commits de fix, discussões ou postmortems.

## Contexto para fornecer à IA

Escolha uma ou mais fontes e cole o conteúdo:

- **Commits de fix/hotfix**: `git log --oneline --grep="fix\|hotfix\|bug" -50`
- **PRs de bugfix**: Descrições e comentários de PRs relevantes
- **Mensagens de erro conhecidas**: Logs de erros recorrentes
- **Discussões do time**: Threads de Slack, comentários de code review

---

## Prompt

```
Você é um assistente técnico extraindo armadilhas conhecidas para o AI Harness Framework.

O arquivo `memory/mistakes.md` documenta erros reais que aconteceram no projeto
para que IAs não os repitam. Cada entrada deve ter: o problema, a causa raiz
e a solução correta.

Vou te fornecer histórico do projeto (commits, PRs, discussões).

Com base neles, identifique padrões de erro recorrentes ou bugs significativos
e gere entradas no formato:

## [YYYY-MM] {Título curto e descritivo}
**Problema**: O que acontecia de errado e em qual contexto.
**Causa raiz**: Por que acontecia.
**Solução correta**: Como resolver ou evitar corretamente.
**Referência**: Arquivo ou skill relacionada (se aplicável)

Critérios para incluir uma entrada:
- O erro aconteceu de verdade (não é hipotético)
- Tem causa raiz identificável
- A solução correta não é trivialmente óbvia
- Poderia acontecer novamente se a IA não soubesse

Critérios para excluir:
- Erros de ambiente/infra que não se repetem
- Bugs já corrigidos estruturalmente (impossível repetir)
- Erros óbvios que qualquer dev evitaria

[COLE AQUI O HISTÓRICO DO PROJETO]
```

---

## Após receber o output

1. Revise — confirme que cada entrada é precisa e acionável
2. Adicione ao final de `.harness/memory/mistakes.md`
3. Rode `harness sync`
