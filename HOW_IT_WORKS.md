# How It Works

## The core idea

The AI Harness is a folder (`.harness/`) that lives inside your project and acts as its **external memory**. It holds everything an AI needs to work well in your specific codebase — rules, domain knowledge, known mistakes, architectural decisions, and domain-specific skills.

When you open a session, the AI reads these files. Instead of starting from zero, it starts from everything your project has learned.

It's not a framework that wraps AI calls. It has no runtime. It's structured files that any AI tool can read — because reading files is something every AI tool already does.

---

## The pieces

```
.harness/
├── core/          ← what the AI always loads
├── skills/        ← specialized knowledge per domain
├── hooks/         ← behavior at specific moments
├── commands/      ← slash commands (/review, /fix, /test...)
├── memory/        ← what the project has learned over time
└── evolution/     ← proposed improvements awaiting approval
```

### `core/` — permanent context

Three files the AI loads in every session:

- **`rules.md`** — non-negotiable constraints. "Never use `any` to paper over a type error." "Always run typecheck before considering a task done." "Never modify migrations without checking `memory/decisions.md`."
- **`glossary.md`** — the project's vocabulary. What `Customer` means here vs `User`. What `holerite` is. Ensures the AI uses the right names consistently.
- **`context.md`** — generated automatically by `harness sync`. Stack, structure, entry points, critical files. Never written by hand.

### `skills/` — domain knowledge

Skills are the specialized knowledge for specific parts of your project. A payroll skill knows the INSS progressive table, the `taxSnapshot` pattern, which package is canonical. A NFS-e skill knows the digital certificate encryption requirements.

The AI loads only the relevant skill for the current task — not everything at once. Each skill declares its context budget (estimated tokens), which commands require it, and which other skills complement it.

Every skill has `examples/good/` and `examples/bad/` — concrete code showing the right pattern and the anti-pattern, with comments explaining why.

### `hooks/` — behavioral guardrails

Hooks are instructions the AI follows at specific moments. They don't contain domain knowledge — they enforce consistent behavior.

| Hook | When | Blocks? |
|------|------|---------|
| `pre-task` | Before any task | ✅ |
| `post-task` | After completing a task | ❌ |
| `on-error` | When something fails | ✅ |
| `on-ambiguity` | When input is unclear | ✅ |
| `on-skill-load` | Before loading a skill | ❌ |
| `on-command` | Before running a slash command | ✅ |

`pre-task` is the most important: is the scope clear? is the right skill loaded? has `memory/mistakes.md` been checked? what's the plan before acting?

`post-task` is where value accumulates: did something new get learned? should a mistake be documented? should a pattern be captured? If yes — suggest `/harness-update`.

### `commands/` — slash commands

Commands like `/review`, `/fix`, `/refactor`, `/test`, `/audit`, `/harness-update` are defined once in `commands/shared/` as plain Markdown with frontmatter. Each defines: inputs, steps the AI should follow, expected output format, and which project commands to run (`{{commands.typecheck}}`).

`harness sync` reads these and generates the right format for each active tool:

- **Cursor** → `.cursor/rules/cmd-review.mdc`
- **Claude Code** → section in `CLAUDE.md`
- **Copilot** → summary in `copilot-instructions.md`

Commands are only generated for tools that support them — Copilot doesn't get slash command definitions, for instance.

### `memory/` — accumulated knowledge

This is where the harness compounds in value over time.

- **`mistakes.md`** — errors that happened and how to fix them. The INSS flat-rate bug. The missing `taxSnapshot`. The migration process that breaks under concurrency. Documented once, prevented forever.
- **`decisions.md`** — architectural decision records. Why the tax calculator lives in a shared package. Why digital certificates are encrypted with AES-256-GCM. Why the monorepo structure was chosen. Context that prevents the AI from "improving" things that were deliberately designed that way.
- **`patterns.md`** — what works well. How services are structured here. What a good test looks like in this codebase.

### `evolution/` — supervised self-improvement

The harness improves over time, but never automatically. Proposed changes go to `evolution/proposed/` as diffs, wait for explicit human approval, then get applied. This prevents the harness from editing itself unexpectedly.

---

## The CLI

Two commands. That's it.

```bash
# First time — bootstraps .harness/ in your project
npx @ai-harness/cli init

# Daily use — regenerates adapters for active tools
harness sync
```

**`init`** inspects your project automatically:
- Reads `package.json` for name, scripts, dependencies
- Detects monorepo via `pnpm-workspace.yaml`, `workspaces`, or `turbo.json`
- Infers stack from installed packages (NestJS, Next.js, Prisma, etc.)
- Identifies package manager from lockfile
- Finds entry points (`src/main.ts`, `app/layout.tsx`, etc.)

It generates a `project-details.json`, then **stops and asks you to review** before doing anything else. No silent assumptions.

**`sync`** reads `harness.config.json` and `project-details.json`, resolves `{{placeholders}}` like `{{commands.typecheck}}` → `pnpm typecheck`, then writes the adapter files for each active tool.

---

## A typical session

```
You open Cursor
        │
        ▼
AI loads harness-main.mdc (alwaysApply: true)
Reads: core/rules.md + core/glossary.md
        │
        ▼
You describe a task
        │
        ▼
AI follows pre-task.md:
  ├── Scope clear? If not → on-ambiguity.md
  ├── Identifies domain → loads relevant skill
  ├── Checks memory/mistakes.md for known traps
  ├── Checks memory/decisions.md for relevant ADRs
  └── Declares plan before acting
        │
        ▼
Execution
  └── Error? → on-error.md
              ├── Classify: syntactic / logical / environmental
              ├── Check memory/mistakes.md — seen before?
              └── Max 2 attempts same approach, then escalate
        │
        ▼
AI follows post-task.md:
  ├── Runs typecheck (mandatory) + lint + test if relevant
  ├── Captures new mistakes, patterns, decisions
  └── Suggests /harness-update if something was learned
        │
        ▼
You review proposed changes, approve what makes sense
harness sync regenerates adapters
```

---

## How knowledge accumulates

Month 1: mostly empty memory files, generic skills.

Month 3: `memory/mistakes.md` has 8 entries — real bugs from your actual codebase. Skills have been refined with project-specific examples. The AI stops suggesting the anti-patterns your team eliminated.

Month 6: A new developer joins. Their AI tool reads the harness and immediately knows the domain vocabulary, the architectural decisions, the patterns that work here. The onboarding context that usually lives in people's heads is now structured and accessible.

This is the core value proposition: **the longer a project uses the harness, the better the AI gets at working on that project.**

---

## What it is not

- Not an AI wrapper or orchestrator — it doesn't make API calls
- Not a prompt injection layer — it's structured files, not hidden instructions
- Not tied to any single AI provider — Cursor, Claude Code, Copilot, anything that reads files
- Not a replacement for good code, tests, or documentation — it augments them
- Not autonomous — the AI suggests, humans approve
