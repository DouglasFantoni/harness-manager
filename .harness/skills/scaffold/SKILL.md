# Skill: Scaffold

## Meta

```yaml
domain: backend
weight: ~400
exposes_command: []
required_by: ["/review", "/audit"]
load_with: []
conflicts_with: []
```

## Quando usar

Ao editar qualquer arquivo dentro de `scaffold/` — os arquivos padrão
que são copiados para `.harness/` do usuário durante o `init`.

## Quando NÃO usar

Para lógica de cópia do scaffold (isso é responsabilidade de `src/commands/init.ts`).

## Contexto essencial

- `scaffold/` é copiado integralmente para `.harness/` do usuário
- Arquivos do scaffold NÃO são processados pelo TypeScript — são Markdown e JSON puros
- `{{placeholders}}` nos arquivos de `commands/shared/` são resolvidos pelo sync em runtime
- `project-details.json` nunca está no scaffold — é gerado pelo detector
- `.gitkeep` em diretórios vazios é intencional — mantém a estrutura no git

## Regras

- Nunca adicionar lógica TypeScript no scaffold — apenas Markdown e JSON
- Manter os arquivos do scaffold leves — são lidos em toda sessão de IA
- Toda mudança no scaffold é uma mudança de contrato com os usuários existentes
- Novos arquivos no scaffold devem ser referenciados em `scaffold/HARNESS.md`
- `scaffold/harness.config.json` é o template — não é o config do harness-manager em si

## Padrões

- Arquivos de hooks: máximo ~300 tokens — serem leves é o objetivo
- Arquivos de commands: frontmatter com `supported_by`, `description`, `globs`
- Arquivos de skills: seguir exatamente o template em `scaffold/skills/_template/SKILL.md`
- Memory files: apenas formato de entrada documentado — conteúdo é do usuário

## Checklist de execução

- [ ] Mudança mantém compatibilidade com projetos existentes que já rodaram `init`?
- [ ] Novos arquivos estão referenciados em `scaffold/HARNESS.md`?
- [ ] `commands/_index.md` foi atualizado se um novo command foi adicionado?
- [ ] `skills/_index.md` foi atualizado se uma nova skill foi adicionada?

## Referências

- `scaffold/HARNESS.md` — entry point da IA no projeto do usuário
- `src/commands/init.ts` — lógica de cópia do scaffold
- `src/adapters/` — lê o scaffold para gerar os adapters
