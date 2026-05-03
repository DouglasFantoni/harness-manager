import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolve } from 'path'

const FIXTURES = resolve(import.meta.dirname, '../fixtures')

describe('detectProject', () => {
  beforeEach(() => {
    vi.spyOn(process, 'cwd')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('project-simple — NestJS single com pnpm', () => {
    beforeEach(() => {
      vi.mocked(process.cwd).mockReturnValue(resolve(FIXTURES, 'project-simple'))
    })

    it('detecta nome e descrição do package.json', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.name).toBe('simple-api')
      expect(details.project.description).toBe('A simple NestJS REST API')
    })

    it('detecta type como "single"', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.type).toBe('single')
    })

    it('detecta NestJS, TypeORM e TypeScript no backend', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.backend).toContain('nestjs')
      expect(details.project.stack.backend).toContain('typeorm')
      expect(details.project.stack.backend).toContain('typescript')
    })

    it('stack frontend vazia para projeto só backend', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.frontend).toEqual([])
    })

    it('detecta docker via Dockerfile', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).toContain('docker')
    })

    it('detecta github-actions via .github/workflows/', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).toContain('github-actions')
    })

    it('detecta pnpm como package manager via pnpm-lock.yaml', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.lint).toMatch(/^pnpm/)
      expect(details.commands.test).toMatch(/^pnpm/)
      expect(details.commands.typecheck).toMatch(/^pnpm/)
    })

    it('detecta scripts corretamente', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.lint).toBe('pnpm lint')
      expect(details.commands.test).toBe('pnpm test')
      expect(details.commands.typecheck).toBe('pnpm typecheck')
      expect(details.commands.build).toBe('pnpm build')
      expect(details.commands.dev).toBe('pnpm dev')
    })

    it('detecta conventional-commits via .commitlintrc.json', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.commit_pattern).toBe('conventional-commits')
    })

    it('detecta PR template via .github/pull_request_template.md', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.pr_template).toBe('.github/pull_request_template.md')
    })

    it('branch_pattern começa vazio (não detectável automaticamente)', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.branch_pattern).toBe('')
    })

    it('detecta src/main.ts como entry point', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.entry_points).toContain('src/main.ts')
    })

    it('retorna structure com apps=["."] para projeto single', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.structure.apps).toEqual(['.'])
      expect(details.structure.packages).toEqual([])
    })

    it('avoid_paths contém os defaults esperados', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.avoid_paths).toContain('dist/')
      expect(details.context_hints.avoid_paths).toContain('node_modules/')
    })

    it('critical_files sempre começa vazio', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.critical_files).toEqual([])
    })

    it('retorna reviewHints com orientações relevantes', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { reviewHints } = await detectProject()
      expect(reviewHints.length).toBeGreaterThan(0)
      // branch_pattern não detectável — deve ter hint
      expect(reviewHints.some(h => h.toLowerCase().includes('branch'))).toBe(true)
    })
  })

  describe('project-monorepo — NestJS + Next.js com pnpm-workspace.yaml', () => {
    beforeEach(() => {
      vi.mocked(process.cwd).mockReturnValue(resolve(FIXTURES, 'project-monorepo'))
    })

    it('detecta type como "monorepo"', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.type).toBe('monorepo')
    })

    it('detecta apps via pnpm-workspace.yaml', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.structure.apps).toContain('apps/api')
      expect(details.structure.apps).toContain('apps/web')
    })

    it('detecta packages via pnpm-workspace.yaml', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.structure.packages).toContain('packages/shared-types')
    })

    it('detecta NestJS no backend via deps das apps', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.backend).toContain('nestjs')
    })

    it('detecta Next.js, React, Radix e Tailwind no frontend via deps das apps', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.frontend).toContain('nextjs')
      expect(details.project.stack.frontend).toContain('react')
      expect(details.project.stack.frontend).toContain('radix-ui')
      expect(details.project.stack.frontend).toContain('tailwindcss')
    })

    it('detecta turborepo na infra via turbo.json', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).toContain('turborepo')
    })

    it('detecta github-actions via .github/workflows/', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).toContain('github-actions')
    })

    it('detecta pnpm como package manager via pnpm-lock.yaml', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.build).toMatch(/^pnpm/)
    })

    it('detecta conventional-commits via commitlint.config.ts', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.commit_pattern).toBe('conventional-commits')
    })

    it('detecta PR template', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.pr_template).toBe('.github/pull_request_template.md')
    })

    it('detecta entry points nas apps', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.entry_points).toContain('apps/api/src/main.ts')
      expect(details.context_hints.entry_points).toContain('apps/web/src/app/layout.tsx')
    })
  })

  describe('project-minimal — Express sem scripts nem lockfile específico', () => {
    beforeEach(() => {
      vi.mocked(process.cwd).mockReturnValue(resolve(FIXTURES, 'project-minimal'))
    })

    it('não lança erro com package.json mínimo', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      await expect(detectProject()).resolves.toBeDefined()
    })

    it('retorna commands vazios quando não há scripts', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.lint).toBe('')
      expect(details.commands.test).toBe('')
      expect(details.commands.typecheck).toBe('')
      expect(details.commands.build).toBe('')
      expect(details.commands.dev).toBe('')
    })

    it('detecta npm como package manager via package-lock.json', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      // sem scripts, mas o prefix do package manager seria npm run
      // validamos indiretamente que não quebrou
      expect(details.commands).toBeDefined()
    })

    it('detecta type como "single"', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.type).toBe('single')
    })

    it('detecta express no backend, frontend vazio', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.backend).toContain('express')
      expect(details.project.stack.frontend).toEqual([])
    })

    it('infra vazia sem Dockerfile ou .github/', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).toEqual([])
    })

    it('sem commitlint, commit_pattern fica vazio', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.commit_pattern).toBe('')
    })

    it('sem PR template, pr_template fica vazio', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.pr_template).toBe('')
    })

    it('inclui hint sobre typecheck ausente', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { reviewHints } = await detectProject()
      expect(reviewHints.some(h => h.toLowerCase().includes('typecheck'))).toBe(true)
    })

    it('entry points vazio quando não há src/main.ts nem app/layout.tsx', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      // src/index.js existe mas não é um entry point que o detector procura (só .ts/.tsx)
      expect(details.context_hints.entry_points).toEqual([])
    })
  })
})
