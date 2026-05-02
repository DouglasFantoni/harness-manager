---
description: "Refatora o código selecionado mantendo comportamento externo"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /refactor

## Input

- `$SELECTION` ou `$FILE` (obrigatório)
- `--goal` → objetivo: `readability` | `performance` | `types` | `patterns` (default: `readability`)

## Steps

1. Identificar o domínio e carregar skill relevante de `skills/_index.md`
2. Verificar `memory/patterns.md` — o refactor deve convergir para padrões estabelecidos
3. Verificar `memory/mistakes.md` — não introduzir anti-padrões conhecidos
4. Declarar **o que vai mudar e o que vai permanecer igual** antes de escrever
5. Executar refactor com foco no `--goal` declarado
6. Garantir que o comportamento externo é idêntico ao original
7. Rodar `{{commands.typecheck}}` e `{{commands.test}}` para confirmar
8. Se o refactor revelar um padrão novo e bom → propor em `memory/patterns.md`

## Output

```
### Refactor: {filename}

**Objetivo**: {goal}
**O que mudou**: {lista do que foi alterado}
**O que não mudou**: {comportamento externo preservado}
**Validação**: typecheck ✅ | test ✅
```

## Referências de projeto

- Typecheck: `{{commands.typecheck}}`
- Test: `{{commands.test}}`

## Notas

- Nunca combine refactor com mudança de comportamento na mesma operação
- Se os testes atuais não cobrem o código refatorado, sinalize — não invente cobertura
- Refactor que muda interface pública exige aprovação explícita antes de executar
- Nunca altere arquivos fora do escopo declarado
