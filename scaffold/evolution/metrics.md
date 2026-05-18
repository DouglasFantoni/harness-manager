# Métricas de Assertividade

> Consolidação periódica dos dados de `feedback.md`.
> Atualize com `harness metrics --write` (intervalo em `harness.config.json` → `evolution.metrics_interval_days`).

## Como interpretar

- **Confidence média** crescente → harness está evoluindo bem
- **Outcome `failed` recorrente** em uma skill → skill precisa de atualização
- **Skill nunca usada** → pode estar mal descrita no `_index.md`
- **Command com `partial` frequente** → steps do command precisam de revisão

## Consolidado

<!-- Exemplo de formato:

### YYYY-MM

| Skill | Sessões | Success | Partial | Failed | Confidence média |
|-------|---------|---------|---------|--------|-----------------|
| nome-skill | 12 | 10 | 1 | 1 | 4.1 |

| Command | Invocações | Success | Partial | Failed |
|---------|-----------|---------|---------|--------|
| /review | 8 | 7 | 1 | 0 |

**Observações**: ...
-->
