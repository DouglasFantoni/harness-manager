# Commands Registry

> Fonte da verdade sobre quais commands existem e quais tools os suportam.
> O sync usa este arquivo para gerar apenas o que cada tool ativa suporta.

| Comando | Descrição | Cursor | Claude Code | Copilot | Arquivo |
|---------|-----------|--------|-------------|---------|---------|
| `/review` | Code review estruturado | ✅ | ✅ | ❌ | `shared/review.md` |
| `/explain` | Explica código selecionado | ✅ | ✅ | ✅ | `shared/explain.md` |
| `/refactor` | Refatora mantendo comportamento | ✅ | ✅ | ❌ | `shared/refactor.md` |
| `/test` | Gera ou complementa testes | ✅ | ✅ | ❌ | `shared/test.md` |
| `/fix` | Corrige problema ou erro ativo | ✅ | ✅ | ✅ | `shared/fix.md` |
| `/audit` | Auditoria de segurança e performance | ✅ | ✅ | ❌ | `shared/audit.md` |
| `/harness-update` | Evolui o harness (requer aprovação) | ✅ | ✅ | ❌ | `shared/harness-update.md` |

## Regra do sync

Apenas commands com ✅ para a tool ativa são gerados no adapter correspondente.
Commands com ❌ são ignorados silenciosamente para aquela tool.

## Adicionando um novo command

1. Copie `commands/_template.md` para `commands/shared/{nome}.md`
2. Preencha todos os campos, incluindo `supported_by`
3. Adicione uma linha neste arquivo
4. Rode `harness sync` para gerar nos adapters ativos
