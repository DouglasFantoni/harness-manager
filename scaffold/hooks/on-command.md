# Hook: On-Command

> weight: ~150 | bloqueia: sim
> Disparado antes de executar qualquer slash command.

## Checklist

- [ ] Este command está em `commands/_index.md` com ✅ para a tool ativa?
- [ ] Se não → informe o usuário que o comando não é suportado nesta tool
- [ ] O command requer uma skill? → verificar `required_by` no `skills/_index.md`
- [ ] Há um `requires` declarado no command que deve rodar antes?

## Sequência de execução garantida

```
on-command  (este hook)
     ↓
on-skill-load  (se o command carregar skill)
     ↓
pre-task  (sempre)
     ↓
execução do command
     ↓
post-task  (sempre)
```

> A sequência é sempre respeitada, mesmo que pareça redundante.
> Hooks não se pulam.
