---
description: "Corrige o problema descrito ou o erro ativo no terminal"
supported_by: ["cursor", "claude-code", "copilot"]
requires: []
auto_run_after: []
globs: []
---

# Command: /fix

## Input

- `$SELECTION`, `$FILE` ou erro do terminal (obrigatório — pelo menos um)
- `--safe` → mostra diff e aguarda aprovação antes de aplicar (default: false)

## Steps

1. Identificar o tipo de erro (via `hooks/on-error.md`):
   - Sintático, lógico, ambiental ou desconhecido
2. Verificar `memory/mistakes.md` — este erro já foi visto antes?
   - **Sim** → seguir a solução documentada
   - **Não** → investigar a causa raiz antes de agir
3. Identificar a **causa raiz**, não apenas o sintoma
4. Declarar o plano de fix em 1–2 linhas antes de aplicar
5. Se `--safe`: exibir diff completo e aguardar aprovação
6. Aplicar o fix mínimo necessário (sem refactor não solicitado)
7. Rodar `{{commands.typecheck}}` + `{{commands.lint}}` + `{{commands.test}}`
8. Se o erro não existia em `memory/mistakes.md` → propor adição via `post-task`

## Output

```
### Fix: {descrição do problema}

**Causa raiz**: {o que causava o erro}
**Solução aplicada**: {o que foi alterado}
**Validação**: typecheck ✅ | lint ✅ | test ✅
```

## Referências de projeto

- Typecheck: `{{commands.typecheck}}`
- Lint: `{{commands.lint}}`
- Test: `{{commands.test}}`

## Notas

- Máximo 2 tentativas com a mesma abordagem — na 3ª, mude a estratégia ou escale
- Nunca use `any` para resolver type error
- Nunca remova o teste que falhou
- Nunca aplique fix sem entender a causa raiz
