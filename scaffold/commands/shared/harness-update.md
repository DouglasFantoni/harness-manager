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
1.5. Verificar se existem traces em `evolution/traces/`:
   - Se existirem arquivos `.json` (exceto `_template.json`), ler os **10 mais recentes**
   - Usar os traces para identificar padrões antes de propor mudanças:
     - Skills que aparecem em traces com `outcome: failed` ou `revisions_needed > 1`
     - Erros em `errors_encountered` que se repetem entre traces
     - Comandos em `commands_run` que resultam em falha recorrente
     - Resoluções repetidas em `resolution` — candidatas a virar regra permanente
   - Se não existirem traces, pular este passo silenciosamente

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
