---
description: "Auditoria de segurança e performance do arquivo ou módulo"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /audit

## Input

- `$SELECTION`, `$FILE` ou diretório (obrigatório)
- `--focus` → `security` | `performance` | `all` (default: `all`)

## Steps

1. Identificar o domínio e carregar skill relevante de `skills/_index.md`
2. Verificar `memory/mistakes.md` — armadilhas conhecidas neste domínio

### Se `--focus=security` ou `all`:
3. Verificar:
   - Inputs não sanitizados ou não validados
   - Dados sensíveis expostos em logs, respostas ou erros
   - Autenticação e autorização nos endpoints
   - Secrets hardcoded ou em variáveis visíveis
   - Dependências com vulnerabilidades conhecidas
   - Injeção (SQL, command, path traversal)

### Se `--focus=performance` ou `all`:
4. Verificar:
   - Queries N+1 ou loops com I/O
   - Dados carregados desnecessariamente (over-fetching)
   - Ausência de paginação em listagens
   - Ausência de cache onde seria aplicável
   - Operações síncronas bloqueando o event loop

5. Rodar `{{commands.typecheck}}` ao final

## Output

```
### Audit: {filename}

**Segurança**
🔴 Crítico: {issue}
🟡 Atenção: {issue}
✅ OK: {aspecto verificado}

**Performance**
🔴 Crítico: {issue}
🟡 Atenção: {issue}
✅ OK: {aspecto verificado}

**Score geral**: {n}/10
```

## Referências de projeto

- Typecheck: `{{commands.typecheck}}`

## Notas

- Não aplique correções automaticamente — audit é somente leitura
- Se encontrar vulnerabilidade crítica → sinalize antes de continuar a análise
- Priorize findings por impacto real, não por quantidade
