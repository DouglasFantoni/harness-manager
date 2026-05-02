---
description: "Explica o código selecionado com contexto do projeto"
supported_by: ["cursor", "claude-code", "copilot"]
requires: []
auto_run_after: []
globs: []
---

# Command: /explain

## Input

- `$SELECTION` ou `$FILE` (obrigatório)
- `--depth` → nível de detalhe: `brief` | `full` (default: `full`)

## Steps

1. Identificar o domínio do código selecionado
2. Verificar `core/glossary.md` — usar a terminologia correta do projeto
3. Carregar skill relevante de `skills/_index.md` se o domínio for específico
4. Explicar na seguinte ordem:
   - **O que faz**: propósito em uma linha
   - **Como funciona**: fluxo principal passo a passo
   - **Por que foi feito assim**: decisões de design (verificar `memory/decisions.md`)
   - **O que pode dar errado**: edge cases e armadilhas conhecidas (`memory/mistakes.md`)
5. Se `--depth=brief`: apenas "O que faz" e "Como funciona"

## Output

```
### {nome da função/arquivo/bloco}

**O que faz**
{descrição em 1–2 linhas}

**Como funciona**
{fluxo passo a passo}

**Por que assim**
{contexto de decisão, se disponível em memory/decisions.md}

**Cuidados**
{armadilhas ou edge cases relevantes}
```

## Notas

- Sempre use a terminologia de `core/glossary.md` na explicação
- Se a explicação revelar código confuso ou sem razão aparente → sinalize ao usuário
- Não sugira mudanças — este command é somente leitura
