# Hook: On-Skill-Load

> weight: ~100 | bloqueia: não
> Disparado internamente antes de carregar qualquer skill.

## Checklist rápido

- [ ] O peso desta skill + skills já carregadas está dentro de 40% do `context_tokens_est`?
- [ ] Esta skill tem `conflicts_with` que já esteja carregado?
- [ ] Esta skill tem `load_with` que também deva ser carregado?

## Se o budget estiver estourado

1. Identifique a skill menos relevante para a task atual
2. Descarregue-a antes de carregar a nova
3. Registre no raciocínio qual skill foi priorizada e por quê

## Referência de budget por tool

| Tool | `context_tokens_est` | Budget de skills (40%) |
|------|---------------------|------------------------|
| claude-code | ~20.000 | ~8.000 tokens |
| cursor | ~8.000 | ~3.200 tokens |
| copilot | ~3.000 | ~1.200 tokens |

Valores reais em `harness.config.json`.
