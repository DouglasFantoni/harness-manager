# Regras Globais

> Estas regras são inegociáveis e se aplicam a qualquer task, em qualquer domínio.
> Edição: somente humanos. A IA nunca altera este arquivo.

## Comportamento geral

- Sempre consulte `skills/_index.md` antes de iniciar uma task com domínio identificável
- Sempre rode ao menos `typecheck` antes de considerar uma task concluída
- Nunca aplique refatorações não solicitadas junto com a task pedida
- Nunca silencie erros para "fazer funcionar"
- Nunca assuma que o código está correto sem validação técnica

## Escopo de mudanças

- Altere apenas o que foi pedido — sem efeitos colaterais não declarados
- Se a task tocar mais de 3 arquivos não relacionados, questione o escopo antes
- Migrations e alterações de schema exigem verificação em `memory/decisions.md`

## Comunicação

- Declare o plano antes de executar — 2 a 3 linhas do que será feito
- Em caso de ambiguidade, consulte `hooks/on-ambiguity.md` e faça UMA pergunta
- Nunca avance com suposições silenciosas em pontos críticos

## Evolução do harness

- Sugestões de melhoria no harness vão para `evolution/proposed/` primeiro
- Nenhuma alteração em `.harness/` é aplicada sem aprovação explícita
- O comando `/harness-update` é a única forma de propor mudanças

## Sobre os comandos do projeto

Os comandos disponíveis (lint, test, typecheck, build) estão em `project-details.json`.
Sempre use esses comandos para validação — nunca invente variações.

## Ferramentas de busca

- Use `rg` (ripgrep) ao invés de `grep` em todos os comandos bash
- `rg` respeita `.gitignore` por padrão — sem ruído de `node_modules/`, `dist/`, `.next/`
- Prefira `rg -l` quando só precisar dos nomes dos arquivos (mais rápido, menos tokens)
- Use `rg --type ts` ou `rg --type js` para limitar ao tipo de arquivo relevante
- Use `rg -F` para busca de string literal (mais rápido que regex quando não precisa de padrão)
- Se `rg` não estiver disponível: `grep -r --exclude-dir={node_modules,dist,.next,coverage}`
