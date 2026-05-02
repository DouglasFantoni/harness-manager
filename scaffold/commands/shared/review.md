---
description: "Code review estruturado do arquivo ou seleção atual"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /review

## Input

- `$SELECTION` ou `$FILE` (obrigatório)
- `--focus` → área de foco: `security` | `performance` | `readability` | `all` (default: `all`)

## Steps

1. Identificar o domínio do arquivo e carregar skill relevante de `skills/_index.md`
2. Verificar `memory/mistakes.md` — listar armadilhas conhecidas que se aplicam
3. Verificar `memory/patterns.md` — checar consistência com padrões estabelecidos
4. Executar review por categoria conforme `--focus`:
   - **Correctness**: lógica, edge cases, tipos
   - **Consistency**: alinhamento com `memory/patterns.md`
   - **Coverage**: testes existentes cobrem os casos relevantes?
   - **Security**: inputs, autenticação, dados sensíveis
   - **Performance**: queries N+1, loops desnecessários, memória
5. Rodar `{{commands.typecheck}}` e `{{commands.lint}}` antes de finalizar
6. Se encontrar padrão novo e bom → propor adição em `memory/patterns.md`

## Output

```
### Review: {filename}

**Crítico** (bloqueia merge)
- [ ] {issue} — {linha ou função}

**Importante** (deve corrigir)
- [ ] {issue}

**Sugestão** (opcional)
- [ ] {issue}

**Score**: {n}/10
**Referência de skill usada**: {skill ou "nenhuma"}
```

## Referências de projeto

- Typecheck: `{{commands.typecheck}}`
- Lint: `{{commands.lint}}`

## Notas

- Nunca sugira mudanças fora do escopo do arquivo revisado
- Se o arquivo tocar múltiplos domínios, declare quais skills foram consideradas
- Score abaixo de 6 deve ter ao menos um item Crítico explicando o porquê
