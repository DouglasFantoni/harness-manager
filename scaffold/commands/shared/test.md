---
description: "Gera ou complementa testes para o arquivo atual"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /test

## Input

- `$FILE` (obrigatório)
- `--coverage` → exibe gaps de cobertura após rodar (default: false)
- `--watch` → instrui a rodar em modo watch (default: false)

## Steps

1. Ler o arquivo alvo e identificar o domínio
2. Verificar `memory/patterns.md` — usar padrões de teste estabelecidos no projeto
3. Identificar o que já está testado — não duplicar
4. Mapear casos a cobrir:
   - Caminho feliz (happy path)
   - Edge cases (null, undefined, limite, vazio)
   - Erros esperados (exceptions, validações)
   - Comportamento assíncrono (se aplicável)
5. Gerar os testes seguindo o padrão do projeto
6. Rodar `{{commands.test}}` para confirmar que passam
7. Se `--coverage`: rodar `{{commands.custom.testCoverage}}` e apontar gaps restantes

## Output

```
### Testes gerados: {filename}

**Casos cobertos**:
- ✅ {caso}

**Casos não cobertos** (fora do escopo ou inviáveis):
- ⚠️ {caso} — {motivo}

**Validação**: {{commands.test}} ✅
```

## Referências de projeto

- Test: `{{commands.test}}`
- Coverage: `{{commands.custom.testCoverage}}`

## Notas

- Nunca remova testes existentes para fazer os novos passarem
- Se o código não é testável como está → sinalize e sugira o refactor necessário
- Mocks devem refletir contratos reais, não ser inventados
- Siga o framework de testes já usado no projeto (Jest, Vitest, etc.)
