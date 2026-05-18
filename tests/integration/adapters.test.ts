import { access, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectDetails, Registry, ToolConfig } from '../../src/types.js'

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
    {
      name: 'test-domain',
      domain: 'backend',
      weight: 800,
      globs: ['**/*.ts'],
      exposes_command: [],
      required_by: ['/review'],
      load_with: [],
      conflicts_with: [],
      source: null,
      sync: true,
    },
  ],
  hooks: [
    { name: 'pre-task', file: 'pre-task.md', triggers: 'start', blocks: true, weight: 300, always_load: true },
    { name: 'on-error', file: 'on-error.md', triggers: 'error', blocks: true, weight: 250, always_load: true },
  ],
}

async function setupHarness() {
  const harnessDir = resolve(TMP, '.harness')
  await mkdir(resolve(harnessDir, 'commands/shared'), { recursive: true })
  await mkdir(resolve(harnessDir, 'commands/generated/claude-code'), { recursive: true })
  await mkdir(resolve(harnessDir, 'core'), { recursive: true })
  await mkdir(resolve(harnessDir, 'skills'), { recursive: true })
  await mkdir(resolve(harnessDir, 'hooks'), { recursive: true })
  await mkdir(resolve(harnessDir, 'skills/test-domain/examples/good'), { recursive: true })
  await mkdir(resolve(harnessDir, 'skills/_template'), { recursive: true })

  // Arquivos essenciais que os adapters leem
  await writeFile(resolve(harnessDir, 'core/rules.md'), '# Regras\n\n- Sempre rodar typecheck\n')
  await writeFile(resolve(harnessDir, 'core/context.md'), '# Context\n\nNestJS + Next.js project\n')
  await writeFile(resolve(harnessDir, 'skills/_index.md'), '# Skills\n\n| nestjs | backend | ~800 | — | /review |\n')
  await writeFile(
    resolve(harnessDir, 'skills/test-domain/SKILL.md'),
    `# Skill: Test Domain

## Quando usar

When testing mirror integration, use this skill.

## Other

Body after first section.
`,
  )
  await writeFile(resolve(harnessDir, 'skills/test-domain/examples/good/sample.txt'), 'sample asset\n')
  await writeFile(
    resolve(harnessDir, 'skills/_template/SKILL.md'),
    `# Skill: Template\n\n## Quando usar\n\nShould not mirror.\n`,
  )
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
    agent_skills_mirror_root: '.cursor/skills/_harness',
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
    expect(content).toContain('.cursor/skills/_harness')
  })

  it('modo dry-run não escreve nenhum arquivo', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    const result = await adapter.generate(true)
    expect(result.files.length).toBeGreaterThan(0)
    const exists = await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))
    expect(exists).toBe(false)
    const mirrorSkill = resolve(TMP, '.cursor/skills/_harness/skills/test-domain/SKILL.md')
    expect(result.files).toContain(mirrorSkill)
    expect(await fileExists(mirrorSkill)).toBe(false)
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
    const emptyRegistry: Registry = { commands: [], skillGlobs: [], skills: [], hooks: [] }
    const adapter = new CursorAdapter(cursorConfig, project, emptyRegistry)
    await expect(adapter.generate()).resolves.toBeDefined()
  })

  it('espelha skills com frontmatter Cursor e corpo original', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const skillPath = resolve(TMP, '.cursor/skills/_harness/skills/test-domain/SKILL.md')
    const content = await readFile(skillPath, 'utf-8')
    expect(content.startsWith('---\n')).toBe(true)
    expect(content).toMatch(/name:\s*"test-domain"/)
    expect(content).toMatch(/description:\s*"When testing mirror integration/)
    expect(content).toContain('# Skill: Test Domain')
    expect(content).toContain('## Quando usar')
  })

  it('copia assets recursivos ao lado de SKILL.md', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const asset = resolve(TMP, '.cursor/skills/_harness/skills/test-domain/examples/good/sample.txt')
    expect(await fileExists(asset)).toBe(true)
    expect(await readFile(asset, 'utf-8')).toContain('sample asset')
  })

  it('espelha hooks como .../hooks/<nome>/SKILL.md', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const hookPath = resolve(TMP, '.cursor/skills/_harness/hooks/pre-task/SKILL.md')
    const content = await readFile(hookPath, 'utf-8')
    expect(content.startsWith('---\n')).toBe(true)
    expect(content).toMatch(/name:\s*"pre-task"/)
    expect(content).toContain('# Pre-Task')
  })

  it('não espelha skills/_template', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const templateMirror = resolve(TMP, '.cursor/skills/_harness/skills/_template/SKILL.md')
    expect(await fileExists(templateMirror)).toBe(false)
  })

  it('usa agent_skills_mirror_root do config quando customizado', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const customRoot = '.custom/mirror-skills'
    const adapter = new CursorAdapter(
      { ...cursorConfig, agent_skills_mirror_root: customRoot },
      project,
      registry,
    )
    await adapter.generate()
    const skillPath = resolve(TMP, `${customRoot}/skills/test-domain/SKILL.md`)
    expect(await fileExists(skillPath)).toBe(true)
    const main = await readFile(resolve(TMP, '.cursor/rules/harness-main.mdc'), 'utf-8')
    expect(main).toContain(`${customRoot}/`)
  })

  it('gera hooks.json com entradas _harness a partir dos hooks markdown', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const hooksJson = JSON.parse(
      await readFile(resolve(TMP, '.cursor/hooks.json'), 'utf-8'),
    )
    expect(hooksJson.version).toBe(1)
    expect(hooksJson.hooks.beforeSubmitPrompt?.some((h: { _harness: string }) => h._harness === 'pre-task')).toBe(true)
    expect(hooksJson.hooks.postToolUseFailure?.some((h: { _harness: string }) => h._harness === 'on-error')).toBe(true)
  })

  it('gera MCP recomendado quando supports_mcp é true', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    expect(await fileExists(resolve(TMP, '.cursor/mcp.recommended.json'))).toBe(true)
    expect(await fileExists(resolve(TMP, '.cursor/MCP-RECOMMENDED.md'))).toBe(true)
    const main = await readFile(resolve(TMP, '.cursor/rules/harness-main.mdc'), 'utf-8')
    expect(main).toContain('MCP-RECOMMENDED.md')
  })

  it('não gera MCP quando supports_mcp é false', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(
      { ...cursorConfig, supports_mcp: false },
      project,
      registry,
    )
    await adapter.generate()
    expect(await fileExists(resolve(TMP, '.cursor/mcp.recommended.json'))).toBe(false)
  })

  it('remove subtree espelhada obsoleta na próxima sync', async () => {
    const { CursorAdapter } = await import('../../src/adapters/cursor.js')
    const adapter = new CursorAdapter(cursorConfig, project, registry)
    await adapter.generate()
    const stale = resolve(TMP, '.cursor/skills/_harness/skills/stale-manual/SKILL.md')
    await mkdir(resolve(stale, '..'), { recursive: true })
    await writeFile(stale, '---\nname: stale\n---\n', 'utf-8')
    expect(await fileExists(stale)).toBe(true)
    await adapter.generate()
    expect(await fileExists(stale)).toBe(false)
    expect(await fileExists(resolve(TMP, '.cursor/skills/_harness/skills/test-domain/SKILL.md'))).toBe(true)
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
    copilot_mirror_root: '.github/harness',
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

  it('espelha skills e hooks compactos em .github/harness/', async () => {
    const { CopilotAdapter } = await import('../../src/adapters/copilot.js')
    const adapter = new CopilotAdapter(copilotConfig, project, registry)
    await adapter.generate()
    const skillMirror = resolve(TMP, '.github/harness/skills/test-domain.md')
    const hookMirror = resolve(TMP, '.github/harness/hooks/pre-task.md')
    expect(await fileExists(skillMirror)).toBe(true)
    expect(await fileExists(hookMirror)).toBe(true)
    const instructions = await readFile(resolve(TMP, '.github/copilot-instructions.md'), 'utf-8')
    expect(instructions).toContain('.github/harness/skills/test-domain.md')
    expect(instructions).toContain('.github/harness/hooks/pre-task.md')
  })

  it('não inclui pre-task inline completo — referencia mirror', async () => {
    const { CopilotAdapter } = await import('../../src/adapters/copilot.js')
    const adapter = new CopilotAdapter(copilotConfig, project, registry)
    await adapter.generate()
    const instructions = await readFile(resolve(TMP, '.github/copilot-instructions.md'), 'utf-8')
    expect(instructions).not.toMatch(/## Antes de Qualquer Task/)
  })
})
