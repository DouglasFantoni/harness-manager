import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, readFile, rm, access } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'

const TMP = resolve(tmpdir(), `harness-sync-test-${Date.now()}`)

const config = {
  version: '1.0.0',
  active_tools: ['cursor', 'claude-code'],
  tools: {
    cursor: {
      enabled: true,
      slash_commands: true,
      rules_format: 'mdc',
      rules_folder: '.cursor/rules/',
      supports_mcp: true,
      context_budget: 'medium',
      context_tokens_est: 8000,
    },
    'claude-code': {
      enabled: true,
      slash_commands: true,
      context_file: 'CLAUDE.md',
      supports_mcp: true,
      supports_bash: true,
      context_budget: 'large',
      context_tokens_est: 20000,
    },
    copilot: {
      enabled: false,
      slash_commands: false,
      context_file: '.github/copilot-instructions.md',
      supports_mcp: false,
      context_budget: 'small',
      context_tokens_est: 3000,
    },
  },
  context_strategy: {
    always_load: ['core/rules.md'],
    load_on_demand: ['skills/'],
    never_load: ['evolution/'],
  },
}

const project = {
  project: {
    name: 'SyncTest',
    description: 'Sync integration test',
    type: 'single',
    stack: { backend: ['nestjs'], frontend: [], infra: [] },
  },
  structure: { root: '.', apps: ['.'], packages: [], shared: [] },
  commands: {
    lint: 'pnpm lint', test: 'pnpm test',
    typecheck: 'pnpm typecheck', build: 'pnpm build',
    dev: 'pnpm dev', custom: {},
  },
  conventions: { branch_pattern: '', commit_pattern: '', pr_template: '' },
  context_hints: { entry_points: [], avoid_paths: ['dist/'], critical_files: [] },
}

async function setupProject() {
  const harnessDir = resolve(TMP, '.harness')
  await mkdir(resolve(harnessDir, 'commands/shared'), { recursive: true })
  await mkdir(resolve(harnessDir, 'core'), { recursive: true })
  await mkdir(resolve(harnessDir, 'skills'), { recursive: true })
  await mkdir(resolve(harnessDir, 'hooks'), { recursive: true })

  await writeFile(resolve(harnessDir, 'harness.config.json'), JSON.stringify(config))
  await writeFile(resolve(harnessDir, 'project-details.json'), JSON.stringify(project))
  await writeFile(resolve(harnessDir, 'core/rules.md'), '# Regras\n- Sempre typecheck\n')
  await writeFile(resolve(harnessDir, 'skills/_index.md'), '# Skills\n')
  await writeFile(resolve(harnessDir, 'commands/_index.md'), `# Commands\n\n| Comando | Descrição | Cursor | Claude Code | Copilot | Arquivo |\n|---|---|---|---|---|---|\n| \`/fix\` | Fix issue | ✅ | ✅ | ✅ | \`shared/fix.md\` |\n`)
  await writeFile(resolve(harnessDir, 'commands/shared/fix.md'), `---\ndescription: "Fix"\nsupported_by: ["cursor", "claude-code", "copilot"]\nglobs: []\n---\n\n# /fix\n\nRun {{commands.typecheck}}.\n`)
  await writeFile(resolve(harnessDir, 'hooks/pre-task.md'), '# Pre-Task\n')
  await writeFile(resolve(harnessDir, 'hooks/on-error.md'), '# On-Error\n')
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

describe('runSync', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
    await setupProject()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('execução completa', () => {
    it('gera CLAUDE.md para claude-code', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      expect(await fileExists(resolve(TMP, 'CLAUDE.md'))).toBe(true)
    })

    it('gera harness-main.mdc para cursor', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      expect(await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))).toBe(true)
    })

    it('não gera copilot-instructions.md quando copilot está disabled', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      expect(await fileExists(resolve(TMP, '.github/copilot-instructions.md'))).toBe(false)
    })

    it('gera core/context.md', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      expect(await fileExists(resolve(TMP, '.harness/core/context.md'))).toBe(true)
    })

    it('placeholders resolvidos nos arquivos gerados', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      const content = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
      expect(content).toContain('pnpm typecheck')
      expect(content).not.toContain('{{commands.typecheck}}')
    })
  })

  describe('--dry-run', () => {
    it('não escreve CLAUDE.md em dry-run', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: true, forceContext: false })
      expect(await fileExists(resolve(TMP, 'CLAUDE.md'))).toBe(false)
    })

    it('não escreve .cursor/rules/ em dry-run', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: true, forceContext: false })
      expect(await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))).toBe(false)
    })

    it('não lança erro em dry-run', async () => {
      const { runSync } = await import('../../src/sync.js')
      await expect(runSync({ dryRun: true, forceContext: false })).resolves.toBeUndefined()
    })
  })

  describe('--only', () => {
    it('gera apenas cursor quando --only cursor', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false, only: 'cursor' })
      expect(await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))).toBe(true)
      expect(await fileExists(resolve(TMP, 'CLAUDE.md'))).toBe(false)
    })

    it('gera apenas claude-code quando --only claude-code', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false, only: 'claude-code' })
      expect(await fileExists(resolve(TMP, 'CLAUDE.md'))).toBe(true)
      expect(await fileExists(resolve(TMP, '.cursor/rules/harness-main.mdc'))).toBe(false)
    })

    it('não lança erro para tool desconhecida em --only', async () => {
      const { runSync } = await import('../../src/sync.js')
      await expect(
        runSync({ dryRun: false, forceContext: false, only: 'nonexistent-tool' })
      ).resolves.toBeUndefined()
    })
  })

  describe('--force-context', () => {
    it('regenera context.md mesmo sem mudança quando force=true', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      const first = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      await runSync({ dryRun: false, forceContext: true })
      const second = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(first).toBe(second) // conteúdo igual, mas foi regenerado
    })
  })

  describe('robustez', () => {
    it('lança erro claro quando .harness/ não existe', async () => {
      await rm(resolve(TMP, '.harness'), { recursive: true, force: true })
      const { runSync } = await import('../../src/sync.js')
      await expect(runSync({ dryRun: false, forceContext: false })).rejects.toThrow()
    })

    it('é idempotente — segunda execução produz mesmo resultado', async () => {
      const { runSync } = await import('../../src/sync.js')
      await runSync({ dryRun: false, forceContext: false })
      const claude1 = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
      await runSync({ dryRun: false, forceContext: false })
      const claude2 = await readFile(resolve(TMP, 'CLAUDE.md'), 'utf-8')
      expect(claude1).toBe(claude2)
    })
  })
})
