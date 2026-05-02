import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, readFile, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'
import type { ProjectDetails } from '../../src/types.js'

const TMP = resolve(tmpdir(), `harness-ctx-test-${Date.now()}`)

const baseProject: ProjectDetails = {
  project: {
    name: 'My Project',
    description: 'Test project',
    type: 'single',
    stack: { backend: ['nestjs', 'typescript'], frontend: ['nextjs'], infra: ['docker'] },
  },
  structure: { root: '.', apps: ['apps/api'], packages: ['packages/shared'], shared: [] },
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

describe('generateContext', () => {
  beforeEach(async () => {
    await mkdir(resolve(TMP, '.harness/core'), { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('geração básica', () => {
    it('cria core/context.md', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toBeTruthy()
    })

    it('inclui o nome do projeto', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('My Project')
    })

    it('inclui a stack', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('nestjs')
      expect(content).toContain('nextjs')
      expect(content).toContain('docker')
    })

    it('inclui entry points', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('apps/api/src/main.ts')
    })

    it('inclui critical files', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('apps/api/src/app.module.ts')
    })

    it('inclui paths a ignorar', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('dist/')
    })

    it('contém aviso de "não edite manualmente"', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('Não edite manualmente')
    })

    it('retorna true quando arquivo é criado', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      const updated = await generateContext(baseProject)
      expect(updated).toBe(true)
    })
  })

  describe('idempotência', () => {
    it('retorna false quando conteúdo não mudou', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const updated = await generateContext(baseProject)
      expect(updated).toBe(false)
    })

    it('retorna true quando projeto mudou', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const modifiedProject = {
        ...baseProject,
        project: { ...baseProject.project, name: 'Novo Nome' },
      }
      const updated = await generateContext(modifiedProject)
      expect(updated).toBe(true)
    })

    it('force=true sempre regenera mesmo sem mudança', async () => {
      const { generateContext } = await import('../../src/context-gen.js')
      await generateContext(baseProject)
      const updated = await generateContext(baseProject, true)
      expect(updated).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('lida com stack vazia sem crash', async () => {
      const project = {
        ...baseProject,
        project: {
          ...baseProject.project,
          stack: { backend: [], frontend: [], infra: [] },
        },
      }
      const { generateContext } = await import('../../src/context-gen.js')
      await expect(generateContext(project)).resolves.toBe(true)
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('Stack')
    })

    it('lida com arrays vazios sem crash', async () => {
      const project = {
        ...baseProject,
        context_hints: { entry_points: [], avoid_paths: [], critical_files: [] },
        structure: { root: '.', apps: [], packages: [], shared: [] },
      }
      const { generateContext } = await import('../../src/context-gen.js')
      await expect(generateContext(project)).resolves.toBeDefined()
    })

    it('lida com package.json de apps ausente graciosamente', async () => {
      // apps/api não existe no TMP — deve retornar fallback
      const { generateContext } = await import('../../src/context-gen.js')
      await expect(generateContext(baseProject)).resolves.toBeDefined()
      const content = await readFile(resolve(TMP, '.harness/core/context.md'), 'utf-8')
      expect(content).toContain('apps/api')
    })

    it('lida com convenções vazias', async () => {
      const project = {
        ...baseProject,
        conventions: { branch_pattern: '', commit_pattern: '', pr_template: '' },
      }
      const { generateContext } = await import('../../src/context-gen.js')
      await expect(generateContext(project)).resolves.toBeDefined()
    })
  })
})
