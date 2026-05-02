# Changelog do Harness

> Histórico de mudanças no próprio harness.
> Toda alteração aprovada via `/harness-update` gera uma entrada aqui.

## Formato de entrada

```markdown
## {YYYY-MM-DD} — {Título}
**Tipo**: skill-update | skill-new | memory | command | hook | config
**Arquivo**: `.harness/{caminho}`
**Mudança**: O que foi alterado e por quê.
**Aprovado por**: humano
```

---

## {data de instalação} — Inicialização do harness

**Tipo**: config  
**Arquivo**: `.harness/`  
**Mudança**: Harness inicializado via `npx @ai-harness/cli init`.  
**Aprovado por**: humano
