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

- **Cursor** → `.cursor/rules/cmd-review.mdc` (Project Rules) e **Agent Skills** em `.cursor/skills/_harness/` (espelho com frontmatter nativo do Cursor a partir de `.harness/skills/*/SKILL.md` e `.harness/hooks/*.md`). Tudo sob `_harness/` é reescrito a cada sync; a fonte editável continua sendo `.harness/`.
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

**`sync`** lê `harness.config.json` e `project-details.json`, resolve `{{placeholders}}` como `{{commands.typecheck}}` → `pnpm typecheck` e escreve os arquivos de adapter para cada tool ativa. Com Cursor ativo, o subtree em `tools.cursor.agent_skills_mirror_root` (padrão `.cursor/skills/_harness`) é apagado e recriado a partir de `.harness/skills/` e `.harness/hooks/` — edite sempre a cópia em `.harness/` e rode `harness sync` de novo.

---

## Uma sessão típica

```
Você abre o Cursor
        │
        ▼
IA carrega harness-main.mdc (alwaysApply: true)
Lê: core/rules.md + core/glossary.md; skills/hooks canônicos em `.harness/` e cópias em `.cursor/skills/_harness/` (rode `harness sync` após editar `.harness/`)
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

**Não integra APIs de IA.** O harness não faz chamadas para OpenAI, Anthropic, ou qualquer outro provedor. Ele não tem chave de API, não tem custo de uso de modelo, não depende de nenhum serviço externo estar disponível. Essa é uma decisão deliberada — ver seção abaixo.

**Não é um wrapper ou orquestrador.** Não intercepta as chamadas que o Cursor ou Claude Code fazem. Não tem runtime próprio que fica em execução.

**Não é injeção de prompt oculta.** São arquivos Markdown que você pode ler, editar e versionar. Nada acontece sem que você saiba.

**Não está preso a nenhum provedor.** Cursor, Claude Code, Copilot, Zed, Windsurf — qualquer ferramenta que lê arquivos do projeto funciona com o harness.

**Não substitui bom código, testes ou documentação.** Complementa — não compensa dívida técnica.

**Não é autônomo.** A IA sugere, humanos aprovam. O harness nunca se edita sozinho.

---

## Por que não integramos APIs de IA

Algumas tarefas do harness se beneficiariam de IA — enriquecer o `project-details.json`,
gerar um glossário inicial, extrair armadilhas do histórico de commits.

Optamos por não integrar APIs diretamente por algumas razões:

- **Agnóstico de modelo**: Você usa o modelo que já tem — Claude, GPT-4, Gemini, o que for. O harness não força nenhuma escolha.
- **Sem chaves de API**: Nenhuma configuração de credenciais, nenhum custo surpresa, nenhuma dependência de serviço externo.
- **Você controla o contexto**: Você decide o que a IA vê. Nenhum arquivo é enviado automaticamente para nenhum servidor.
- **Sem lock-in**: Se um modelo melhor aparecer amanhã, você simplesmente usa ele.

Em vez de chamadas de API, o harness fornece **prompts prontos** que você copia e cola na IA que já está usando.

---

## Prompts disponíveis

A pasta [`prompts/`](./prompts/) contém prompts para as tarefas que se beneficiam de IA:

| Prompt | O que faz |
|--------|-----------|
| [`init-enrich.md`](./prompts/init-enrich.md) | Enriquece o `project-details.json` após o `init` |
| [`skill-create.md`](./prompts/skill-create.md) | Cria uma nova skill a partir dos arquivos do domínio |
| [`glossary-generate.md`](./prompts/glossary-generate.md) | Gera o glossário inicial a partir do código |
| [`rules-generate.md`](./prompts/rules-generate.md) | Gera as regras iniciais a partir das convenções do projeto |
| [`mistakes-extract.md`](./prompts/mistakes-extract.md) | Extrai armadilhas do histórico de commits e PRs |

Cada prompt especifica exatamente qual contexto fornecer e o que fazer com o output.
