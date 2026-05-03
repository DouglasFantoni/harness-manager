---
description: "Popula o harness com conteúdo real do projeto usando IA como orquestrador"
supported_by: ["cursor", "claude-code"]
requires: []
auto_run_after: []
globs: []
---

# Command: /setup

Popula o harness com conteúdo real do projeto.
Deve ser executado logo após `harness init`, quando o harness ainda está vazio.

## Pré-condições

- [ ] `harness init` já foi executado (`.harness/` existe)
- [ ] `project-details.json` foi revisado
- [ ] Você está na raiz do projeto

## Comportamento

Este comando ativa a skill `harness-orchestrator`.

Leia `.harness/skills/harness-orchestrator/SKILL.md` e siga o protocolo
de execução descrito lá — incluindo a decisão de usar sub-agentes paralelos
ou execução sequencial conforme suas capacidades.

Em resumo, o que deve acontecer:

1. **Reconhecimento** — entender o projeto e identificar domínios de negócio
2. **Glossário** — gerar `.harness/core/glossary.md` com os termos do domínio
3. **Regras** — gerar `.harness/core/rules.md` com as convenções do projeto
4. **Armadilhas** — gerar `.harness/memory/mistakes.md` a partir do histórico git
5. **Skills** — criar uma skill em `.harness/skills/` para cada domínio identificado
6. **Sync** — executar `{{commands.sync}}` para regenerar os adapters
7. **Resumo** — reportar o que foi criado e o que precisa de revisão

## Notas

- Falha em uma etapa não deve abortar as demais — continue e reporte
- Adicione ao invés de sobrescrever arquivos que já têm conteúdo
- O output é um rascunho — o desenvolvedor revisa antes de commitar
- Número de skills criadas depende dos domínios encontrados no projeto
