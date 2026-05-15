# AI Harness Framework

> Um framework de contexto vivo e auto-evolutivo que aumenta a assertividade de IAs em projetos de software. Agnóstico de linguagem, acoplável a qualquer projeto, compatível com Cursor, Claude Code e GitHub Copilot.

---

## O que é

O AI Harness é uma estrutura de arquivos que vive dentro do seu projeto (`.harness/`) e serve como **memória externalizada e estruturada** para IAs. Em vez de começar do zero a cada sessão, a IA carrega contexto acumulado do projeto — regras, decisões, padrões, armadilhas conhecidas e skills específicas do domínio.

A assertividade cresce porque:

- Erros não se repetem (`memory/mistakes.md` os documenta)
- Skills são calibradas para o seu domínio, não genéricas
- Hooks orientam o comportamento antes, durante e após cada task
- O vocabulário do projeto é consistente via glossário
- Cada sessão alimenta a próxima via feedback estruturado

---

## Instalação

```bash
# Na raiz do projeto
npx harness sync --init
```

O `--init` detecta automaticamente o projeto e gera o `project-details.json` com base em:

- `package.json` (nome, scripts, dependências)
- `pnpm-workspace.yaml` / `turbo.json` / `nx.json` (estrutura de monorepo)
- Dependências instaladas (stack: NestJS, Next.js, React, Prisma, etc.)
- `tsconfig.json`, `.commitlintrc`, `.github/` (convenções)
- Entry points e estrutura de pastas

Após a detecção, o harness **para e pede revisão**:

```
📋 project-details.json gerado com base no projeto

⚠️  REVISE antes de continuar:
   • Verifique se project.description está correto
   • Preencha context_hints.critical_files com os arquivos mais importantes
   • Confirme branch_pattern usado no projeto
   • Confirme se todos os commands estão corretos
   • Remova entradas de stack incorretas

   Depois de revisar: npx harness sync
```

Depois de revisar:

```bash
npx harness sync
```

---

## Estrutura de arquivos

```
.harness/
├── harness.config.json          ← quais IAs estão ativas e suas capacidades
├── project-details.json         ← específico do projeto (gerado no --init)
├── project-details.example.json ← template para novos projetos
│
├── core/
│   ├── context.md               ← snapshot do projeto (gerado pelo sync)
│   ├── rules.md                 ← regras globais inegociáveis
│   └── glossary.md              ← vocabulário do domínio
│
├── commands/
│   ├── _index.md                ← registry com suporte por tool
│   ├── _template.md             ← como criar um novo comando
│   ├── shared/                  ← fonte da verdade (agnóstica de IA)
│   │   ├── audit.md
│   │   ├── explain.md
│   │   ├── fix.md
│   │   ├── refactor.md
│   │   ├── review.md
│   │   ├── test.md
│   │   └── harness-update.md
│   └── generated/               ← gerado pelo sync, nunca edite à mão
│       ├── cursor/
│       └── claude-code/
│
├── skills/
│   ├── _index.md                ← registry com peso de contexto estimado
│   ├── _template/
│   │   ├── SKILL.md
│   │   └── examples/
│   ├── _self-update/            ← skill especial com safeguards próprios
│   │   ├── SKILL.md
│   │   ├── rules.md
│   │   └── dry-run.md
│   └── {domain}/
│       ├── SKILL.md
│       ├── rules.md             ← restrições específicas (opcional)
│       └── examples/
│           ├── good/
│           └── bad/
│
├── hooks/
│   ├── _index.md
│   ├── pre-task.md              ← roda ANTES de qualquer task (bloqueia)
│   ├── post-task.md             ← roda APÓS task concluída
│   ├── on-error.md              ← roda quando algo falha (bloqueia)
│   ├── on-ambiguity.md          ← roda quando input é ambíguo (bloqueia)
│   ├── on-skill-load.md         ← antes de carregar qualquer skill
│   └── on-command.md            ← antes de executar slash command (bloqueia)
│
├── memory/
│   ├── decisions.md             ← ADRs (architectural decision records)
│   ├── mistakes.md              ← armadilhas conhecidas e como resolver
│   ├── patterns.md              ← padrões que funcionaram bem
│   └── sessions.md              ← log de sessões relevantes
│
├── evolution/
│   ├── feedback.md              ← feedback estruturado de cada sessão
│   ├── proposed/                ← mudanças sugeridas aguardando aprovação
│   ├── metrics.md               ← qualidade ao longo do tempo
│   └── changelog.md             ← histórico de mudanças no harness
│
├── adapters/                    ← gerado pelo sync, nunca edite à mão
│   ├── cursor/
│   │   ├── .cursor/rules/
│   │   └── .cursor/skills/_harness/  ← Agent Skills (espelho de .harness/skills + hooks)
│   ├── claude-code/
│   │   └── CLAUDE.md
│   └── copilot/
│       └── .github/copilot-instructions.md
│
└── sync/                        ← o executável do harness
    ├── index.ts
    └── lib/
```

---

## Configuração

### `harness.config.json`

Define quais ferramentas estão ativas e suas capacidades. O sync usa isso para decidir o que gerar.

```json
{
  "version": "1.0.0",
  "active_tools": ["cursor", "claude-code"],

  "tools": {
    "cursor": {
      "enabled": true,
      "slash_commands": true,
      "rules_format": "mdc",
      "rules_folder": ".cursor/rules/",
      "agent_skills_mirror_root": ".cursor/skills/_harness",
      "supports_mcp": true,
      "context_budget": "medium",
      "context_tokens_est": 8000
    },
    "claude-code": {
      "enabled": true,
      "slash_commands": true,
      "context_file": "CLAUDE.md",
      "supports_mcp": true,
      "supports_bash": true,
      "context_budget": "large",
      "context_tokens_est": 20000
    },
    "copilot": {
      "enabled": false,
      "slash_commands": false,
      "context_file": ".github/copilot-instructions.md",
      "supports_mcp": false,
      "context_budget": "small",
      "context_tokens_est": 3000
    }
  },

  "context_strategy": {
    "always_load": ["core/rules.md", "core/glossary.md"],
    "load_on_demand": ["skills/", "memory/"],
    "never_load": ["evolution/", "adapters/"]
  }
}
```

- **`tools.cursor.agent_skills_mirror_root`** — caminho relativo à raiz do repo onde o `sync` grava o espelho das Agent Skills (o diretório inteiro é apagado e recriado). Se mudar do padrão, inclua esse caminho no `.gitignore` do projeto.

### `project-details.json`

Gerado automaticamente no `--init` e revisado manualmente. Contém tudo que é específico do projeto.

```json
{
  "project": {
    "name": "my-project",
    "description": "",
    "type": "monorepo",
    "stack": {
      "backend": ["nestjs", "typescript", "postgres"],
      "frontend": ["nextjs", "react", "typescript"],
      "infra": ["docker", "github-actions"]
    }
  },
  "structure": {
    "root": ".",
    "apps": ["apps/api", "apps/web"],
    "packages": ["packages/shared-types"],
    "shared": ["packages/"]
  },
  "commands": {
    "lint": "pnpm lint",
    "test": "pnpm test",
    "typecheck": "pnpm typecheck",
    "build": "pnpm build",
    "dev": "pnpm dev",
    "custom": {
      "test:coverage": "pnpm test --coverage",
      "db:migrate": "pnpm migration:run"
    }
  },
  "conventions": {
    "branch_pattern": "feat|fix|chore/{ticket}-{description}",
    "commit_pattern": "conventional-commits",
    "pr_template": ".github/pull_request_template.md"
  },
  "context_hints": {
    "entry_points": ["apps/api/src/main.ts", "apps/web/src/app/layout.tsx"],
    "avoid_paths": ["dist/", ".next/", "node_modules/", "coverage/"],
    "critical_files": []
  }
}
```

---

## Skills

Skills são o conhecimento especializado do harness. Cada skill encapsula as regras, padrões e exemplos de um domínio específico do projeto.

### Criando uma skill

Copie `skills/_template/SKILL.md` e preencha:

```markdown
# Skill: {Nome}

## Meta
domain: ""              ← backend | frontend | infra | fiscal | domínio | harness
weight: ~000            ← estimativa de tokens quando carregada
exposes_command: []     ← slash commands que esta skill habilita
required_by: []         ← commands que sempre carregam esta skill
load_with: []           ← skills complementares
conflicts_with: []      ← skills que não devem ser carregadas junto

## Quando usar
## Quando NÃO usar
## Contexto essencial
## Regras
## Padrões
## Checklist de execução
## Referências
```

### Budget de contexto

A soma das skills carregadas em uma sessão não deve ultrapassar **40% do `context_tokens_est`** da tool ativa. O `_index.md` declara o peso estimado de cada skill para facilitar esse controle.

### Exemplos (`good/` e `bad/`)

O few-shot bem feito vale mais que mil palavras de regra. Cada arquivo em `bad/` segue o padrão:

```typescript
// ❌ ANTI-PADRÃO: {nome}
// Problema: {descrição}
// Consequência: {o que acontece de errado}
// Correto: ver examples/good/{arquivo}.ts
// Referência: memory/mistakes.md#{ancora}
```

---

## Slash Commands

Commands são definidos uma vez em `commands/shared/` e o sync gera o formato correto para cada tool.

### Commands disponíveis

| Comando | Descrição | Cursor | Claude Code | Copilot |
|---------|-----------|--------|-------------|---------|
| `/review` | Code review estruturado | ✅ | ✅ | ❌ |
| `/explain` | Explica código selecionado | ✅ | ✅ | ✅ |
| `/refactor` | Refatora mantendo comportamento | ✅ | ✅ | ❌ |
| `/test` | Gera ou complementa testes | ✅ | ✅ | ❌ |
| `/fix` | Corrige problema ou erro ativo | ✅ | ✅ | ✅ |
| `/audit` | Auditoria de segurança/performance | ✅ | ✅ | ❌ |
| `/harness-update` | Atualiza o harness (requer aprovação) | ✅ | ✅ | ❌ |

### Criando um novo command

Copie `commands/_template.md`:

```markdown
# Command: /{nome}

## Meta
description: ""
supported_by: []
requires: []
auto_run_after: []

## Input
## Steps
## Output
## Referências de projeto   ← use {{commands.lint}}, {{project.name}}, etc.
## Notas
```

Os `{{placeholders}}` são resolvidos pelo sync usando `project-details.json`. Nunca hardcode comandos do projeto nos templates.

---

## Hooks

Hooks orientam o comportamento da IA em momentos específicos. São leves e cirúrgicos — referenciam skills e commands sem duplicar seu conteúdo.

| Hook | Dispara quando | Bloqueia? |
|------|---------------|-----------|
| `pre-task` | Início de qualquer task | ✅ Sim |
| `post-task` | Conclusão de qualquer task | ❌ Não |
| `on-error` | Qualquer falha | ✅ Sim |
| `on-ambiguity` | Input incerto ou conflitante | ✅ Sim |
| `on-skill-load` | Antes de carregar uma skill | ❌ Não |
| `on-command` | Antes de executar slash command | ✅ Sim |

### Fluxo de execução

```
Request do usuário
       │
       ├── É um /command? → on-command → on-skill-load → pre-task
       └── Task normal?   → pre-task
              │
              ├── Input ambíguo? → on-ambiguity → aguarda → recomeça
              │
              ▼
           EXECUÇÃO
              │
              ├── Erro? → on-error → tenta resolver → volta
              │
              ▼
           post-task → sugere /harness-update se necessário
```

---

## Memória

A memória é onde o harness acumula valor ao longo do tempo.

### `memory/mistakes.md`

O arquivo mais valioso. Documenta armadilhas conhecidas para que não se repitam.

```markdown
## [YYYY-MM] {Título curto}
**Problema**: O que acontecia de errado
**Solução correta**: Como resolver corretamente
**Referência**: `skills/{domain}/SKILL.md#{ancora}`
```

### `memory/decisions.md`

ADRs (Architectural Decision Records) do projeto.

```markdown
## #{ancora} — {Título}
**Data**: YYYY-MM
**Contexto**: Por que a decisão foi necessária
**Decisão**: O que foi decidido
**Consequências**: O que muda a partir disso
```

### `memory/patterns.md`

Padrões que funcionaram bem e devem ser replicados.

### `memory/sessions.md`

Log local de sessões relevantes. Pode ser gitignored em projetos onde privacidade importa.

---

## Auto-evolução

O harness evolui por **ação explícita do usuário**, não automaticamente. Isso evita edições inesperadas em arquivos.

### Fluxo de evolução

1. Durante o `post-task`, a IA identifica aprendizados (mistakes, patterns, decisões)
2. Sugere ao usuário rodar `/harness-update`
3. O `/harness-update` mostra cada alteração como diff
4. Salva propostas em `evolution/proposed/` antes de aplicar
5. Aguarda aprovação explícita
6. Após aprovação: aplica e roda `harness sync`

### O que a IA pode e não pode tocar

**Pode atualizar (via `/harness-update` com aprovação):**
- `skills/{domain}/SKILL.md`
- `memory/mistakes.md`
- `memory/patterns.md`
- `core/glossary.md`
- `commands/_index.md`
- `evolution/changelog.md`

**Nunca toca (alteração humana apenas):**
- `harness.config.json`
- `project-details.json`
- `core/rules.md`
- `adapters/` (gerado pelo sync)
- Qualquer arquivo fora de `.harness/`

---

## CLI — harness sync

```bash
# Uso normal — regenera adapters para todas as tools ativas
npx harness sync

# Primeira vez — detecta o projeto e gera project-details.json
npx harness sync --init

# Mostra o que seria gerado sem escrever nada
npx harness sync --dry-run

# Só uma tool específica
npx harness sync --only cursor
npx harness sync --only claude-code

# Força regeneração do context.md mesmo sem mudanças detectadas
npx harness sync --force-context
```

### O que o sync nunca sobrescreve

```
.harness/harness.config.json
.harness/project-details.json
.harness/core/rules.md
.harness/core/glossary.md
.harness/memory/
.harness/evolution/proposed/
.harness/skills/        (exceto _index.md)
.harness/hooks/
```

---

## .gitignore recomendado

```gitignore
# Harness — ambiente local
.harness/memory/sessions.md
.harness/evolution/proposed/

# Harness — commitar tudo o mais
# (incluindo project-details.json em projetos internos)
```

Se o projeto for open source ou contiver paths sensíveis:

```gitignore
.harness/project-details.json
```

---

## Adicionando ao projeto existente

```bash
# 1. Instala o harness
npx harness sync --init

# 2. Revisa o project-details.json gerado
# (veja os hints exibidos no terminal)

# 3. Edita core/rules.md com as regras inegociáveis do projeto
# 4. Edita core/glossary.md com o vocabulário do domínio
# 5. Cria as skills do seu domínio em skills/{domain}/

# 6. Gera os adapters
npx harness sync

# 7. Adiciona o script ao package.json
```

```json
{
  "scripts": {
    "harness:sync": "tsx .harness/sync/index.ts",
    "harness:init": "tsx .harness/sync/index.ts --init"
  }
}
```

---

## Suporte de ferramentas

| Capacidade | Cursor | Claude Code | Copilot |
|------------|--------|-------------|---------|
| Slash commands | ✅ | ✅ | ❌ |
| Rules/context file | ✅ `.mdc` + Agent Skills em `.cursor/skills/_harness/` | ✅ `CLAUDE.md` | ✅ `copilot-instructions.md` |
| MCP servers | ✅ | ✅ | ❌ |
| Bash / terminal | ✅ | ✅ | ❌ |
| Context budget | Médio (~8k) | Grande (~20k) | Pequeno (~3k) |

O sync lê `harness.config.json` e gera **apenas o que cada tool suporta**. Tools com `enabled: false` são ignoradas completamente.

---

## Princípios de design

**Leve por padrão.** Hooks e o `HARNESS.md` são intencionalmente curtos. Skills e memória são carregadas sob demanda, não todas de uma vez.

**Fonte única da verdade.** Commands são definidos em `shared/` e convertidos para cada formato. Nada é duplicado.

**Evolução supervisionada.** A IA sugere, o humano aprova. O harness nunca edita a si mesmo sem confirmação explícita.

**Agnóstico de stack.** O harness não conhece NestJS, React ou Prisma — as skills do projeto é que carregam esse conhecimento.

**Transparência total.** O sync reporta exatamente o que foi gerado, atualizado ou ignorado. Nenhum arquivo é sobrescrito silenciosamente.

---

## Licença

MIT
