# Feedback de Sessões

> Registro estruturado de cada sessão que usou skill ou command.
> Alimenta métricas de assertividade e identifica skills que precisam de atualização.
> Preenchido pelo `post-task` ao final de cada sessão relevante.

## Formato de entrada

```yaml
- date: YYYY-MM-DD
  task: descrição curta da task executada
  skill_used: nome-da-skill ou null
  command_used: /comando ou null
  outcome: success | partial | failed
  confidence: 1-5  # 1=muito incerto, 5=totalmente assertivo
  notes: observações opcionais
```

---

# Entradas

<!-- Adicionadas automaticamente pelo post-task hook. -->
