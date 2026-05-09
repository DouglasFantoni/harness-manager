# Rules: Git

## Meta

```yaml
version: "1.0.0"
category: "git"
sync: true
```

## Commits

- Commits seguem Conventional Commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`
- Um commit por mudança lógica — nunca "WIP" ou "fix stuff" em commits finais
- Nunca commitar código comentado, `console.log` de debug ou `TODO` sem issue associada
- Mensagem no imperativo: "adiciona validação" não "adicionei validação"

## Branches

- Branch criada a partir de `main` (ou `develop`) sempre atualizada
- Nunca commitar diretamente em `main` ou `develop` — sempre via PR
- Branch deletada após merge — nunca acumular branches stale
- Nome de branch reflete o trabalho: `feat/login-oauth`, `fix/inss-calculation`

## PRs

- PR pequeno e focado — uma feature ou fix por PR
- Nunca fazer merge sem CI passando
- Reviewer deve entender o contexto pelo título e descrição — sem "ver código"
- Breaking changes documentados explicitamente na descrição do PR

## O que nunca fazer

- Nunca reescrever histórico de branch compartilhada (`--force` em branches de outros)
- Nunca commitar secrets, tokens ou credenciais — mesmo que remova depois (histórico permanece)
- Nunca usar `git add .` sem revisar o que está sendo adicionado
- Nunca resolver conflito de merge sem entender ambos os lados

## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
<!-- HARNESS:CUSTOM:END -->
