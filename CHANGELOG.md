# Changelog

Todas as mudanças notáveis neste projeto serão documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [1.0.0] — 2025

### Adicionado
- Scaffold completo com hooks, skills, commands, memory e evolution
- CLI `harness sync` — gera adapters para Cursor, Claude Code e Copilot
- CLI `harness init` — detecta o projeto e bootstrapa o harness automaticamente
- Detector de stack (NestJS, Next.js, React, Prisma, Docker, etc.)
- Resolução de `{{placeholders}}` via `project-details.json`
- Geração automática de `core/context.md`
- Adapters: Cursor (`.mdc`), Claude Code (`CLAUDE.md`), Copilot (`copilot-instructions.md`)
- 7 slash commands: `/review`, `/explain`, `/refactor`, `/test`, `/fix`, `/audit`, `/harness-update`
- Skill `_self-update` com safeguards para evolução supervisionada
- Exports públicos como lib TypeScript (`runSync`, `runInit`, tipos)
