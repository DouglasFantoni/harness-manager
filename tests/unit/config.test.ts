import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'

// loadConfig usa process.cwd() internamente — precisamos mockar
const TMP = resolve(tmpdir(), `harness-config-test-${Date.now()}`)

const validConfig = {
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
  },
  context_strategy: {
    always_load: ['core/rules.md'],
    load_on_demand: ['skills/'],
    never_load: ['evolution/'],
  },
}

const validProject = {
  project: {
    name: 'test',
    description: 'test',
    type: 'single',
    stack: { backend: [], frontend: [], infra: [] },
  },
  structure: { root: '.', apps: ['.'], packages: [], shared: [] },
  commands: {
    lint: 'pnpm lint',
    test: 'pnpm test',
    typecheck: 'pnpm typecheck',
    build: 'pnpm build',
    dev: 'pnpm dev',
    custom: {},
  },
  conventions: { branch_pattern: '', commit_pattern: '', pr_template: '' },
  context_hints: { entry_points: [], avoid_paths: [], critical_files: [] },
}

async function writeHarness(config: unknown, project: unknown) {
  const harnessDir = resolve(TMP, '.harness')
  await mkdir(harnessDir, { recursive: true })
  if (config !== null) {
    await writeFile(resolve(harnessDir, 'harness.config.json'), JSON.stringify(config))
  }
  if (project !== null) {
    await writeFile(resolve(harnessDir, 'project-details.json'), JSON.stringify(project))
  }
}

describe('loadConfig', () => {
  let originalCwd: () => string

  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    originalCwd = process.cwd.bind(process)
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('carregamento válido', () => {
    it('carrega config e project corretamente', async () => {
      await writeHarness(validConfig, validProject)
      const { loadConfig } = await import('../../src/config.js')
      const { config, project } = await loadConfig()
      expect(config.version).toBe('1.0.0')
      expect(project.project.name).toBe('test')
    })

    it('retorna os tools corretos', async () => {
      await writeHarness(validConfig, validProject)
      const { loadConfig } = await import('../../src/config.js')
      const { config } = await loadConfig()
      expect(config.tools.cursor.enabled).toBe(true)
      expect(config.tools['claude-code'].context_tokens_est).toBe(20000)
    })
  })

  describe('arquivos ausentes', () => {
    it('lança erro claro quando harness.config.json não existe', async () => {
      await writeHarness(null, validProject)
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow('harness.config.json')
    })

    it('lança erro claro quando project-details.json não existe', async () => {
      await writeHarness(validConfig, null)
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow('project-details.json')
    })

    it('mensagem de erro inclui instrução de como resolver', async () => {
      await writeHarness(null, null)
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow('npx @ai-harness/cli init')
    })
  })

  describe('JSON inválido', () => {
    it('lança erro quando harness.config.json é JSON inválido', async () => {
      const harnessDir = resolve(TMP, '.harness')
      await mkdir(harnessDir, { recursive: true })
      await writeFile(resolve(harnessDir, 'harness.config.json'), '{invalid json}')
      await writeFile(resolve(harnessDir, 'project-details.json'), JSON.stringify(validProject))
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow()
    })

    it('lança erro quando project-details.json é JSON inválido', async () => {
      const harnessDir = resolve(TMP, '.harness')
      await mkdir(harnessDir, { recursive: true })
      await writeFile(resolve(harnessDir, 'harness.config.json'), JSON.stringify(validConfig))
      await writeFile(resolve(harnessDir, 'project-details.json'), 'not json at all')
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow()
    })
  })

  describe('validação de campos obrigatórios', () => {
    it('lança erro quando config não tem campo tools', async () => {
      await writeHarness({ version: '1.0.0' }, validProject)
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow('"tools"')
    })

    it('lança erro quando project não tem campo commands', async () => {
      const { commands: _, ...projectWithoutCommands } = validProject
      await writeHarness(validConfig, projectWithoutCommands)
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow('"commands"')
    })

    it('avisa (warn) quando commands obrigatórios estão vazios mas não lança', async () => {
      const project = {
        ...validProject,
        commands: { ...validProject.commands, lint: '', test: '', typecheck: '', build: '' },
      }
      await writeHarness(validConfig, project)
      const warns: string[] = []
      vi.spyOn(console, 'warn').mockImplementation((msg: string) => warns.push(msg))
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).resolves.toBeDefined()
      expect(warns.some(w => w.includes('lint'))).toBe(true)
    })
  })
})
