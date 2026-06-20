---
description: "Propõe evoluções no harness com base no aprendizado da sessão"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /harness-update

> Este command carrega a skill `_self-update` automaticamente.
> Nenhuma alteração é aplicada sem aprovação explícita do usuário.

## Input

- Nenhum argumento obrigatório
- `--dry-run` → apenas lista o que seria proposto, sem criar arquivos (default: false)

## Steps

1. Carregar `skills/_self-update/SKILL.md` e seguir suas regras à risca
1.5. Verificar se `evolution/traces/_analysis.json` existe.
   - **Se existir**: ler o arquivo e usar os `flags` como ponto de partida para as propostas.
     Cada flag já é um padrão detectado — priorize-os em ordem de severidade (`critical` → `warning` → `info`).
     Exemplos de como cada flag se traduz em proposta:
     - `skill_high_failure` → revisar `## Regras` e `## Contexto essencial` da skill
     - `recurring_error` → adicionar ao `memory/mistakes.md` e considerar regra em rule pack
     - `recurring_resolution` → adicionar como padrão em `memory/patterns.md` ou skill
     - `skill_glob_gap` → adicionar globs faltantes ao `## Meta` da skill relevante
     - `resolution_contradicts_rule` → resolver a contradição — regra ou resolução está errada
     - `pre_task_ignored` → reforçar o `pre-task.md` para ser mais explícito
     - `validation_skipped` → adicionar regra de validação obrigatória no rule pack
   - **Se não existir mas houver traces**: informar ao usuário para rodar `harness trace --analyze` antes
   - **Se não existir e não houver traces**: pular este passo silenciosamente

2. Listar o que foi aprendido na sessão atual:
   - Erros encontrados e resolvidos → `memory/mistakes.md`
   - Padrões que funcionaram bem → `memory/patterns.md`
   - Decisões arquiteturais tomadas → `memory/decisions.md`
   - Termos novos do domínio → `core/glossary.md`
   - Skills desatualizadas ou incompletas → `skills/{domain}/SKILL.md`
3. Para cada item, gerar o diff proposto
4. Se `--dry-run`: exibir os diffs e parar aqui
5. Salvar cada proposta em `evolution/proposed/{YYYY-MM-DD}-{arquivo}.md`
6. Exibir resumo e aguardar aprovação explícita do usuário
7. Após aprovação: aplicar apenas o que foi aprovado
8. Registrar em `evolution/changelog.md`
9. Rodar `harness sync` para regenerar adapters

## Output

```
### Propostas de evolução do harness

**1. memory/mistakes.md**
+ ## [YYYY-MM] {título}
+ **Problema**: ...
+ **Solução**: ...

Aprovar esta entrada? (s/n)

---

**Resumo**: {n} propostas | {m} aprovadas | {k} ignoradas
Rodando harness sync...
```

## Notas

- Uma proposta por vez — não empacote múltiplas mudanças em uma aprovação
- Se não houve aprendizado genuíno na sessão → informe e não force entradas
- Nunca toque em `harness.config.json`, `project-details.json` ou `core/rules.md`
- Nunca altere arquivos fora de `.harness/`
