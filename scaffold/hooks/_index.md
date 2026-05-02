# Hooks Registry

| Hook | Dispara quando | Bloqueia execução? | Peso ~ |
|------|---------------|-------------------|--------|
| `pre-task` | Início de qualquer task | ✅ Sim | ~300 |
| `post-task` | Conclusão de qualquer task | ❌ Não | ~200 |
| `on-error` | Qualquer falha ou exceção | ✅ Sim | ~250 |
| `on-ambiguity` | Input incerto ou conflitante | ✅ Sim | ~150 |
| `on-skill-load` | Antes de carregar qualquer skill | ❌ Não | ~100 |
| `on-command` | Antes de executar slash command | ✅ Sim | ~150 |

## Regras de carregamento

- `pre-task` e `on-error` estão em `context_strategy.always_load` — sempre presentes
- Os demais são `load_on_demand` — carregados apenas quando o momento chega
- A soma de todos os hooks ativos nunca deve ultrapassar 20% do `context_tokens_est`

## Sequência garantida para slash commands

```
on-command → on-skill-load → pre-task → EXECUÇÃO → post-task
                                  ↑
                            on-error (se falhar)
                            on-ambiguity (se ambíguo)
```

Hooks não se pulam, mesmo que pareçam redundantes.
