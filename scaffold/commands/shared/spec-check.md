---
description: "Verifica cobertura de testes para os critérios de aceite das specs"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /spec-check

Verifica quais critérios de aceite das specs têm cobertura de testes
e quais ainda estão descobertos.

## Input

- Sem argumentos: verifica todas as specs com status `ready`, `in-progress` ou `done`
- `--feature <nome>`: verifica apenas a spec de uma feature específica
- `--fix`: após reportar, sugere os testes faltantes para cada critério descoberto

## Steps

1. Carregar skill `spec-reader` de `.harness/skills/spec-reader/SKILL.md`
2. Ler `.harness/specs/_index.md` — filtrar specs com status relevante
3. Para cada spec (ou a spec filtrada por `--feature`):
   a. Ler `specs/{feature}/spec.md`
   b. Extrair todos os critérios de aceite (`- [ ]` e `- [x]`)
   c. Para cada critério, buscar nos arquivos de teste (`*.test.ts`, `*.spec.ts`, `*.test.tsx`)
      se existe um caso de teste que claramente o cobre (por nome ou por comportamento)
   d. Classificar: ✅ coberto | ❌ sem cobertura | ⚠️ cobertura parcial ou incerta
4. Se `--fix`: para cada critério ❌, gerar o esqueleto do teste faltante
5. Apresentar relatório (ver Output)

## Output

```
### Spec Check — {data}

#### {feature} [{status}]

US-01 — {título}
  ✅ {critério} → {arquivo de teste}:{linha}
  ❌ {critério} → sem cobertura
  ⚠️  {critério} → cobertura incerta

US-02 — {título}
  ✅ {critério}

---
Resumo: {n} specs | {x} critérios cobertos | {y} sem cobertura | {z} incertos
```

## Referências de projeto

- Test: `{{commands.test}}`
- Typecheck: `{{commands.typecheck}}`

## Notas

- Este comando não modifica nenhum arquivo (exceto com `--fix` que gera sugestões)
- "Cobertura incerta" significa que existe um teste no domínio mas não é claro
  se ele cobre especificamente aquele critério
- Critérios de aceite vagos ou ambíguos serão marcados como ⚠️ com nota explicativa
- Após corrigir cobertura faltante, rode `{{commands.test}}` para confirmar que passam
