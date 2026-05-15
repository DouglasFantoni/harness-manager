# AI Harness Framework

> Um framework de contexto vivo que torna ferramentas de IA progressivamente mais inteligentes sobre o seu projeto específico — entre sessões, entre ferramentas, ao longo do tempo.

**→ [Por que isso existe](./PROBLEM.md)** — o problema que estamos resolvendo e como avaliar se estamos resolvendo de verdade  
**→ [Como funciona](./HOW_IT_WORKS.md)** — walkthrough completo do framework, do CLI e de uma sessão típica  
**→ [Dicas de performance](./PERFORMANCE.md)** — ripgrep, WSL, lazy loading e outras otimizações

---

## O que faz

- **Skills** — conhecimento especializado por domínio, carregado sob demanda. Instaláveis da registry oficial ou criadas localmente. Minificadas automaticamente para economizar tokens.
- **Rules** — regras inegociáveis organizadas em packs (TypeScript, NestJS, segurança, git). Sincronizáveis com a registry, customizáveis por projeto.
- **Hooks** — guardrails de comportamento (`pre-task`, `on-error`, `on-ambiguity`, etc.) que orientam a IA antes, durante e após cada task.
- **Slash commands** — `/review`, `/fix`, `/test`, `/refactor`, `/audit`, `/setup`, `/spec-check` e mais. Definidos uma vez, gerados para cada ferramenta.
- **Memory** — `mistakes.md`, `decisions.md` e `patterns.md` acumulam o que o projeto aprendeu ao longo do tempo.
- **Specs** — sistema de user stories com critérios de aceite rastreáveis. O `/spec-check` verifica cobertura de testes.
- **Registry oficial** — skills e rule packs mantidos centralmente, instaláveis com um comando e atualizáveis preservando customizações do projeto.
- **Auto-registro** — skills, rule packs e hooks criados localmente são detectados e registrados automaticamente no próximo sync.
- **Prompts** — templates prontos para usar com qualquer IA: `harness prompt init-enrich`, `spec-create`, `memory-summarize` e mais.
- **Sem APIs** — nenhuma chamada de IA direta. Funciona com Cursor, Claude Code, Copilot — qualquer ferramenta que lê arquivos.

---

## Instalação

```bash
# Clona e builda localmente (até publicação no npm)
git clone https://github.com/DouglasFantoni/harness-manager.git
cd harness-manager
npm install && npm run build && npm pack

# No seu projeto
pnpm add -D file:../harness-manager/ai-harness-cli-1.0.0.tgz
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

## Primeiros passos

```bash
# 1. Bootstrapa o harness no projeto
npx harness init

# 2. Revisa o project-details.json gerado

# 3. Imprime prompt pronto para enriquecer com IA
harness prompt init-enrich

# 4. Abre Claude Code ou Cursor em modo agente e digita:
/setup   # a IA orquestra: glossário, regras, armadilhas, skills por domínio

# 5. Gera os adapters para as ferramentas ativas
harness sync
```

---

## CLI — referência

```bash
# Bootstrap e sync
harness init                    # detecta projeto, cria .harness/
harness init --force            # reinicializa preservando project-details.json
harness sync                    # regenera adapters para tools ativas
harness sync --dry-run          # preview sem escrever
harness sync --only cursor      # só uma tool
harness sync --force-context    # força regeneração do context.md

# Skills da registry
harness skill-add nestjs        # instala skill da registry oficial
harness skill-sync              # atualiza todas as skills com source
harness skill-sync nestjs       # atualiza skill específica
harness skill-sync --check      # mostra quais têm update disponível
harness skill-sync --dry-run    # diff sem aplicar

# Rule packs da registry
harness rule-add typescript     # instala rule pack
harness rule-add nestjs
harness rule-add security
harness rule-add git
harness rule-sync               # atualiza todos os packs
harness rule-sync --check

# Prompts prontos para IA
harness prompt --list           # lista todos os prompts disponíveis
harness prompt init-enrich      # enriquece project-details.json
harness prompt skill-create     # cria skill a partir de arquivos do domínio
harness prompt spec-create      # cria spec de feature
harness prompt spec-implement   # implementa a partir de spec
harness prompt spec-to-tests    # gera testes dos critérios de aceite
harness prompt memory-summarize # condensa memory quando crescer demais
```

---

## Registry oficial

Skills e rule packs mantidos centralmente e otimizados com o tempo.

**Skills:**

| Comando | Domínio | Globs automáticos |
|---------|---------|-------------------|
| `harness skill-add nestjs` | backend | `**/*.service.ts`, `**/*.controller.ts`, `**/*.module.ts` |
| `harness skill-add nextjs` | frontend | `**/app/**/*.tsx`, `**/components/**/*.tsx` |
| `harness skill-add payroll` | domínio | `**/*.payroll.ts` |

**Rule packs:**

| Comando | Cobre |
|---------|-------|
| `harness rule-add typescript` | Tipos, imports, nullability, async |
| `harness rule-add nestjs` | Estrutura, providers, DTOs, exceptions |
| `harness rule-add security` | Dados sensíveis, auth, inputs, APIs |
| `harness rule-add git` | Commits, branches, PRs |

---

## Customização

Skills e rule packs têm uma seção protegida que o sync nunca sobrescreve:

```markdown
## Customizações do projeto

<!-- HARNESS:CUSTOM:START -->
- Regras específicas do seu projeto aqui
<!-- HARNESS:CUSTOM:END -->
```

Para desativar o sync de um item, defina `sync: false` no `## Meta`.

---

## Caminho inverso — auto-registro

Crie skills, rule packs ou hooks manualmente e o sync os detecta automaticamente:

```bash
mkdir .harness/skills/meu-dominio
vim .harness/skills/meu-dominio/SKILL.md

harness sync
# 🆕 skill detectada e registrada: meu-dominio (backend)
```

O sync injeta `sync: false` e a seção `HARNESS:CUSTOM` em itens locais.

---

## Specs (SDD)

```bash
harness prompt spec-create      # cria spec a partir de uma ideia
harness prompt spec-implement   # implementa cobrindo critérios de aceite
harness prompt spec-to-tests    # gera testes mapeados nos critérios

# No agente:
/spec-check                     # verifica cobertura de todos os critérios
/spec-check --feature login     # verifica feature específica
/spec-check --fix               # sugere testes faltantes
```

---

## Otimização de tokens

O sync reporta métricas reais usando `js-tiktoken`:

```
⚡ 3 skill(s) minificada(s) — 3161 → 2586 tokens (-18%)
```

- **`SKILL.min.md`** gerado automaticamente — remove Meta, Checklist e Referências (30-50% de redução)
- **Lazy loading por glob** — Cursor carrega skills só quando o arquivo aberto corresponde ao padrão
- **`harness prompt memory-summarize`** — condensa memory quando crescer demais

---

## Estrutura

```
.harness/
├── harness.config.json       ← ferramentas ativas
├── project-details.json      ← dados do projeto
├── core/
│   ├── context.md            ← gerado pelo sync
│   ├── rules.md              ← regras globais
│   ├── glossary.md           ← vocabulário do domínio
│   └── rules/                ← rule packs instalados
├── skills/
│   ├── index.json            ← registry (fonte de verdade)
│   └── {domain}/SKILL.md
├── hooks/
│   ├── index.json            ← registry (fonte de verdade)
│   └── pre-task.md, on-error.md ...
├── commands/
│   ├── index.json            ← registry (fonte de verdade)
│   └── shared/review.md, fix.md ...
├── specs/
│   └── {feature}/spec.md
├── memory/
│   ├── decisions.md
│   ├── mistakes.md
│   └── patterns.md
├── evolution/
│   └── proposed/
└── prompts/
    └── init-enrich.md, spec-create.md ...
```

---

## Ferramentas suportadas

| Capacidade | Cursor | Claude Code | Copilot |
|------------|--------|-------------|---------|
| Slash commands | ✅ | ✅ | ❌ |
| Lazy loading por glob | ✅ | ✅ | ❌ |
| MCP servers | ✅ | ✅ | ❌ |
| Context budget | ~8k tokens | ~20k tokens | ~3k tokens |

---

## O que não faz

- Não faz chamadas de API de IA — sem chaves, sem custos, sem lock-in
- Não substitui testes, code review ou documentação — complementa
- Não é autônomo — a IA sugere, humanos aprovam
- Não está preso a nenhum provedor — funciona com qualquer ferramenta que lê arquivos

---

## Licença

MIT — © 2025 Douglas Fantoni
