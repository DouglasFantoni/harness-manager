# Como Funciona

## A ideia central

O AI Harness é uma pasta (`.harness/`) que vive dentro do seu projeto e funciona como sua **memória externalizada**. Ela contém tudo que uma IA precisa para trabalhar bem no seu codebase específico — regras, vocabulário do domínio, erros conhecidos, decisões arquiteturais e skills especializadas.

Quando você abre uma sessão, a IA lê esses arquivos. Em vez de começar do zero, ela começa a partir de tudo que o projeto já aprendeu.

Não é um framework que envolve chamadas de IA. Não tem runtime próprio. São arquivos estruturados que qualquer ferramenta de IA consegue ler — porque ler arquivos é algo que toda ferramenta de IA já faz.

---

## As peças

```
.harness/
├── core/          ← o que a IA sempre carrega
├── skills/        ← conhecimento especializado por domínio
├── hooks/         ← comportamento em momentos específicos
├── commands/      ← slash commands (/review, /fix, /test...)
├── memory/        ← o que o projeto aprendeu ao longo do tempo
└── evolution/     ← melhorias propostas aguardando aprovação
```

### `core/` — contexto permanente

Três arquivos que a IA carrega em toda sessão:

- **`rules.md`** — restrições inegociáveis. "Nunca usar `any` para tapar erro de tipo." "Sempre rodar typecheck antes de considerar uma task pronta." "Nunca modificar migrations sem verificar `memory/decisions.md`."
- **`glossary.md`** — o vocabulário do projeto. O que `Cliente` significa aqui vs `Usuário`. O que é `holerite`. Garante que a IA use os nomes certos de forma consistente.
- **`context.md`** — gerado automaticamente pelo `harness sync`. Stack, estrutura, entry points, arquivos críticos. Nunca escrito à mão.

### `skills/` — conhecimento de domínio

Skills são o conhecimento especializado para partes específicas do projeto. Uma skill de folha de pagamento sabe sobre a tabela progressiva do INSS, o padrão `taxSnapshot`, qual pacote é o canônico. Uma skill de NFS-e sabe sobre os requisitos de criptografia do certificado digital.

A IA carrega apenas a skill relevante para a task atual — não tudo de uma vez. Cada skill declara seu budget de contexto (tokens estimados), quais commands a requerem e quais outras skills a complementam.

Toda skill tem `examples/good/` e `examples/bad/` — código concreto mostrando o padrão correto e o anti-padrão, com comentários explicando o porquê.

### `hooks/` — guardrails de comportamento

Hooks são instruções que a IA segue em momentos específicos. Não contêm conhecimento de domínio — garantem comportamento consistente.

| Hook | Quando | Bloqueia? |
|------|--------|-----------|
| `pre-task` | Antes de qualquer task | ✅ |
| `post-task` | Após concluir uma task | ❌ |
| `on-error` | Quando algo falha | ✅ |
| `on-ambiguity` | Quando o input é ambíguo | ✅ |
| `on-skill-load` | Antes de carregar uma skill | ❌ |
| `on-command` | Antes de executar slash command | ✅ |

O `pre-task` é o mais importante: o escopo está claro? a skill certa foi carregada? `memory/mistakes.md` foi consultado? qual é o plano antes de agir?

O `post-task` é onde o valor se acumula: algo novo foi aprendido? um erro deve ser documentado? um padrão deve ser capturado? Se sim — sugere `/harness-update`.

### `commands/` — slash commands

Commands como `/review`, `/fix`, `/refactor`, `/test`, `/audit`, `/harness-update` são definidos uma vez em `commands/shared/` como Markdown simples com frontmatter. Cada um define: inputs, steps que a IA deve seguir, formato de output esperado e quais comandos do projeto rodar (`{{commands.typecheck}}`).

O `harness sync` lê esses arquivos e gera o formato certo para cada tool ativa:

- **Cursor** → `.cursor/rules/cmd-review.mdc`
- **Claude Code** → seção no `CLAUDE.md`
- **Copilot** → resumo no `copilot-instructions.md`

Commands são gerados apenas para tools que os suportam — o Copilot não recebe definições de slash command, por exemplo.

### `memory/` — conhecimento acumulado

É aqui que o harness cresce em valor ao longo do tempo.

- **`mistakes.md`** — erros que aconteceram e como resolver. O bug da alíquota flat de INSS. O `taxSnapshot` ausente. O processo de migration que quebra sob concorrência. Documentado uma vez, prevenido para sempre.
- **`decisions.md`** — registros de decisão arquitetural. Por que o cálculo de impostos fica num pacote compartilhado. Por que certificados digitais são criptografados com AES-256-GCM. Por que a estrutura de monorepo foi escolhida. Contexto que evita que a IA "melhore" coisas que foram deliberadamente projetadas de determinada forma.
- **`patterns.md`** — o que funciona bem. Como services são estruturados aqui. Como um bom teste se parece neste codebase.

### `evolution/` — auto-melhoria supervisionada

O harness melhora ao longo do tempo, mas nunca automaticamente. Mudanças propostas vão para `evolution/proposed/` como diffs, aguardam aprovação humana explícita e só então são aplicadas. Isso evita que o harness se edite de surpresa.

---

## O CLI

Dois comandos. Só isso.

```bash
# Primeira vez — bootstrapa .harness/ no seu projeto
npx @ai-harness/cli init

# Uso diário — regenera os adapters para as tools ativas
harness sync
```

**`init`** inspeciona seu projeto automaticamente:
- Lê `package.json` para nome, scripts e dependências
- Detecta monorepo via `pnpm-workspace.yaml`, `workspaces` ou `turbo.json`
- Infere stack a partir dos pacotes instalados (NestJS, Next.js, Prisma, etc.)
- Identifica package manager pelo lockfile
- Encontra entry points (`src/main.ts`, `app/layout.tsx`, etc.)

Gera um `project-details.json` preenchido e **para para pedir revisão** antes de fazer qualquer outra coisa. Sem suposições silenciosas.

**`sync`** lê `harness.config.json` e `project-details.json`, resolve `{{placeholders}}` como `{{commands.typecheck}}` → `pnpm typecheck` e escreve os arquivos de adapter para cada tool ativa.

---

## Uma sessão típica

```
Você abre o Cursor
        │
        ▼
IA carrega harness-main.mdc (alwaysApply: true)
Lê: core/rules.md + core/glossary.md
        │
        ▼
Você descreve uma task
        │
        ▼
IA segue pre-task.md:
  ├── Escopo claro? Se não → on-ambiguity.md
  ├── Identifica domínio → carrega skill relevante
  ├── Consulta memory/mistakes.md para armadilhas conhecidas
  ├── Consulta memory/decisions.md para ADRs relevantes
  └── Declara plano antes de agir
        │
        ▼
Execução
  └── Erro? → on-error.md
              ├── Classifica: sintático / lógico / ambiental
              ├── Verifica memory/mistakes.md — já visto antes?
              └── Máx 2 tentativas mesma abordagem, depois escala
        │
        ▼
IA segue post-task.md:
  ├── Roda typecheck (obrigatório) + lint + test se relevante
  ├── Captura erros, padrões e decisões novas
  └── Sugere /harness-update se algo foi aprendido
        │
        ▼
Você revisa as mudanças propostas e aprova o que faz sentido
harness sync regenera os adapters
```

---

## Como o conhecimento se acumula

**Mês 1:** memory files quase vazios, skills genéricas.

**Mês 3:** `memory/mistakes.md` tem 8 entradas — bugs reais do seu codebase. Skills foram refinadas com exemplos específicos do projeto. A IA para de sugerir os anti-padrões que o time eliminou.

**Mês 6:** Um dev novo entra no projeto. Sua ferramenta de IA lê o harness e imediatamente sabe o vocabulário do domínio, as decisões arquiteturais, os padrões que funcionam aqui. O contexto de onboarding que normalmente vive nas cabeças das pessoas está agora estruturado e acessível.

Essa é a proposta de valor central: **quanto mais tempo um projeto usa o harness, melhor a IA fica em trabalhar naquele projeto.**

---

## O que não é

- Não é um wrapper ou orquestrador de IA — não faz chamadas de API
- Não é uma camada de injeção de prompt — são arquivos estruturados, não instruções ocultas
- Não está preso a nenhum provedor de IA — Cursor, Claude Code, Copilot, qualquer ferramenta que lê arquivos
- Não substitui bom código, testes ou documentação — os complementa
- Não é autônomo — a IA sugere, humanos aprovam
