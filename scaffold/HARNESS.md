# HARNESS

> Entry point do AI Harness Framework neste projeto.
> Gerado pelo `harness sync`. Configurações em `harness.config.json`.

## O que é

Este projeto usa o AI Harness — uma estrutura de contexto vivo que orienta IAs
a trabalharem com maior assertividade, consistência e memória acumulada.

## Como usar

1. **Antes de qualquer task** → siga `.harness/hooks/pre-task.md`
2. **Para encontrar a skill certa** → consulte `.harness/skills/_index.md`
3. **Em caso de erro** → siga `.harness/hooks/on-error.md`
4. **Após concluir** → siga `.harness/hooks/post-task.md`
5. **Para evoluir o harness** → rode `/harness-update` e aguarde aprovação

## Arquivos que a IA deve conhecer

| Arquivo | Quando ler |
|---------|-----------|
| `core/rules.md` | Sempre — regras inegociáveis |
| `core/glossary.md` | Sempre — vocabulário do domínio |
| `core/context.md` | Na primeira mensagem da sessão |
| `skills/_index.md` | Ao identificar o domínio da task |
| `memory/mistakes.md` | Antes de executar qualquer task |
| `memory/decisions.md` | Antes de decisões arquiteturais |

## O que nunca fazer sem aprovação humana

- Alterar `harness.config.json` ou `project-details.json`
- Alterar `core/rules.md`
- Aplicar mudanças em `.harness/` sem passar pelo `/harness-update`
- Tocar arquivos fora de `.harness/` como efeito colateral de evolução do harness
