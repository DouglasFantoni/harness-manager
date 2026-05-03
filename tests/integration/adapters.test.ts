import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, readFile, rm, access } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'
import type { ToolConfig, ProjectDetails, Registry } from '../../src/types.js'

const TMP = resolve(tmpdir(), `harness-adapters-test-${Date.now()}`)

const project: ProjectDetails = {
  project: {
    name: 'TestApp',
    description: 'Integration test project',
    type: 'monorepo',
    stack: { backend: ['nestjs'], frontend: ['nextjs'], infra: ['docker'] },
  },
  structure: { root: '.', apps: ['apps/api', 'apps/web'], packages: [], shared: [] },
  commands: {
    lint: 'pnpm lint', test: 'pnpm test',
    typecheck: 'pnpm typecheck', build: 'pnpm build',
    dev: 'pnpm dev', custom: {},
  },
  conventions: { branch_pattern: 'feat|fix/{ticket}', commit_pattern: 'conventional-commits', pr_template: '' },
  context_hints: {
    entry_points: ['apps/api/src/main.ts'],
    avoid_paths: ['dist/', 'node_modules/'],
    critical_files: ['apps/api/src/app.module.ts'],
  },
}

const registry: Registry = {
  commands: [
    { name: '/review', file: 'shared/review.md', description: 'Code review', supported_by: ['cursor', 'claude-code'], requires: [], globs: [] },
    { name: '/fix', file: 'shared/fix.md', description: 'Fix issue', supported_by: ['cursor', 'claude-code', 'copilot'], requires: [], globs: [] },
    { name: '/explain', file: 'shared/explain.md', description: 'Explain code', supported_by: ['copilot'], requires: [], globs: [] },
  ],
  skillGlobs: [],
  skills: [
    { name: 'nestjs', domain: 'backend', weight: 800, exposes_command: [], required_by: ['/review'], load_with: [], conflicts_with: [] },
  ],
}

async function setupHarness() {
  const harnessDir = resolve(TMP, '.harness')
  await mkdir(resolve(harnessDir, 'commands/shared'), { recursive: true })
  await mkdir(resolve(harnessDir, 'commands/generated/claude-code'), { recursive: true })
  await mkdir(resolve(harnessDir, 'core'), { recursive: true })
  await mkdir(resolve(harnessDir, 'skills'), { recursive: true })
  await mkdir(resolve(harnessDir, 'hooks'), { recursive: true })

  // Arquivos essenciais que os adapters leem
  await writeFile(resolve(harnessDir, 'core/rules.md'), '# Regras\n\n- Sempre rodar typecheck\n')
  await writeFile(resolve(harnessDir, 'core/context.md'), '# Context\n\nNestJS + Next.js project\n')
  await writeFile(resolve(harnessDir, 'skills/_index.md'), '# Skills\n\n| nestjs | backend | ~800 | — | /review |\n')
  await writeFile(resolve(harnessDir, 'hooks/pre-task.md'), '# Pre-Task\n\n- [ ] Escopo claro?\n')
  await writeFile(resolve(harnessDir, 'hooks/on-error.md'), '# On-Error\n\n- Classifique o erro\n')

  // Command files com placeholders
  await writeFile(resolve(harnessDir, 'commands/shared/review.md'), `---
description: "Code review"
supported_by: ["cursor", "claude-code"]
globs: []
---

# /review

Run {{commands.typecheck}} before finalizing.
`)

  await writeFile(resolve(harnessDir, 'commands/shared/fix.md'), `---
description: "Fix issue"
supported_by: ["cursor", "claude-code", "copilot"]
globs: ["**/*.ts"]
---

# /fix

Run {{commands.typecheck}} && {{commands.lint}}.
`)

  await writeFile(resolve(harnessDir, 'commands/shared/explain.md'), `---
description: "Explain code"
supported_by: ["copilot"]
globs: []
---

# /explain

Explain the selected code.
`)
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

describe('CursorAdapter', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
    await setupHarness()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  const cursorConfig: ToolConfig = {
    enabled: true,
    slash_commands: true,
    rules_format: 'mdc',
    rules_folder: '.cursor/rules/',
    supports_mcp: true,
    context_budget: 'medium',
    context_tokens_est: 8000,
  }

  it('gera harness-main.mdc', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const exists = await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))
    expect(exists).toBe(true)
  })

  it('harness-main.mdc tem alwaysApply: true', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, '.cursor/rules/harness-main.mdc'), 'utf-8')
    expect(content).toContain('alwaysApply: true')
  })

  it('gera .mdc apenas para commands suportados pelo cursor', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    // /review e /fix suportam cursor; /explain só suporta copilot
    const reviewExists = await fileExists(resolve(TMP, '.cursor/rules/cmd-review.mdc'))
    const explainExists = await fileExists(resolve(TMP, '.cursor/rules/cmd-explain.mdc'))
    expect(reviewExists).toBe(true)
    expect(explainExists).toBe(false)
  })

  it('resolve placeholders nos .mdc gerados', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, '.cursor/rules/cmd-review.mdc'), 'utf-8')
    expect(content).toContain('pnpm typecheck')
    expect(content).not.toContain('{{commands.typecheck}}')
  })

  it('inclui nome do projeto no harness-main.mdc', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, '.cursor/rules/harness-main.mdc'), 'utf-8')
    expect(content).toContain('TestApp')
  })

  it('modo dry-run não escreve nenhum arquivo', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    const result = await adapter.generate(true)
    expect(result.files.length).toBeGreaterThan(0)
    const exists = await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))
    expect(exists).toBe(false)
  })

  it('retorna lista de arquivos gerados', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    const result = await adapter.generate()
    expect(result.files).toContain(resolve(TMP, '.cursor/rules/harness-main.mdc'))
  })

  it('é idempotente — segunda execução produz mesmo resultado', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const first = await readFile(resolve(TMP, '.cursor/rules/harness-main.mdc'), 'utf-8')
    await adapter.generate()
    const second = await readFile(resolve(TMP, '.cursor/rules/harness-main.mdc'), 'utf-8')
    expect(first).toBe(second)
  })

  it('registry sem commands não lança erro', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const emptyRegistry: Registry = { commands: [], skillGlobs: [],
  skills: [] }
    const adapter = new CursorAdapter(cursorConfig, project, emptyRegistry)
    await expect(adapter.generate()).resolves.toBeDefined()
  })
})

describe('ClaudeCodeAdapter', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
    await setupHarness()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  const claudeConfig: ToolConfig = {
    enabled: true,
    slash_commands: true,
    context_file: 'CLAUDE.md',
    supports_mcp: true,
    supports_bash: true,
    context_budget: 'large',
    context_tokens_est: 20000,
  }

  it('gera CLAUDE.md', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const exists = await fileExists(resolve(TMP, 'CLAUDE.md'))
    expect(exists).toBe(true)
  })

  it('CLAUDE.md contém nome do projeto', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('TestApp')
  })

  it('CLAUDE.md inclui regras do core/rules.md', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('typecheck')
  })

  it('resolve placeholders no CLAUDE.md', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('pnpm typecheck')
    expect(content).not.toContain('{{commands.typecheck}}')
  })

  it('inclui apenas commands suportados pelo claude-code', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
    // /review e /fix suportam claude-code; /explain só copilot
    expect(content).toContain('/review')
    expect(content).not.toContain('/explain')
  })

  it('gera cópia em generated/claude-code/', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const exists = await fileExists(
      resolve(TMP, '.harness/commands/generated/claude-code/CLAUDE.md')
    )
    expect(exists).toBe(true)
  })

  it('modo dry-run não escreve CLAUDE.md', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate(true)
    const exists = await fileExists(resolve(TMP, 'CLAUDE.md'))
    expect(exists).toBe(false)
  })

  it('aviso de "não edite manualmente" está presente', async () => {
    const { ClaudeCodeAdapter } = await import('../../src/adapters/claude-code.js')
    const adapter = new ClaudeCodeAdapter(claudeConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
    expect(content).toMatch(/não edite manualmente/i)
  })
})

describe('CopilotAdapter', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
    await setupHarness()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  const copilotConfig: ToolConfig = {
    enabled: false,
    slash_commands: false,
    context_file: '.github/copilot-instructions.md',
    supports_mcp: false,
    context_budget: 'small',
    context_tokens_est: 3000,
  }

  it('gera copilot-instructions.md', async () => {
    const { CopilotAdapter } = await import('../../src/adapters/copilot.js')
    const adapter = new CopilotAdapter(copilotConfig, project, registry)
    await adapter.generate()
    const exists = await fileExists(resolve(TMP, '.github/copilot-instructions.md'))
    expect(exists).toBe(true)
  })

  it('inclui apenas commands suportados pelo copilot', async () => {
    const { CopilotAdapter } = await import('../../src/adapters/copilot.js')
    const adapter = new CopilotAdapter(copilotConfig, project, registry)
    await adapter.generate()
    const content = await readFile(resolve(TMP, '.github/copilot-instructions.md'), 'utf-8')
    // /explain suporta copilot; /review não
    expect(content).toContain('/explain')
    expect(content).not.toContain('/review')
  })

  it('cria o diretório .github/ se não existir', async () => {
    const { CopilotAdapter } = await import('../../src/adapters/copilot.js')
    const adapter = new CopilotAdapter(copilotConfig, project, registry)
    await adapter.generate()
    const exists = await fileExists(resolve(TMP, '.github'))
    expect(exists).toBe(true)
  })

  it('modo dry-run não escreve arquivo', async () => {
    const { CopilotAdapter } = await import('../../src/adapters/copilot.js')
    const adapter = new CopilotAdapter(copilotConfig, project, registry)
    await adapter.generate(true)
    const exists = await fileExists(resolve(TMP, '.github/copilot-instructions.md'))
    expect(exists).toBe(false)
  })
})
