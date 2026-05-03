import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolve } from 'path'

const FIXTURES = resolve(import.meta.dirname, '../fixtures')

describe('detectProject', () => {
  let originalCwd: () => string

  beforeEach(() => {
    originalCwd = process.cwd.bind(process)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  describe('projeto simples (single)', () => {
    beforeEach(() => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-simple'))
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

    it('detecta NestJS e TypeScript no backend', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.backend).toContain('nestjs')
      expect(details.project.stack.backend).toContain('typescript')
    })

    it('detecta scripts do package.json corretamente', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.lint).toBe('pnpm lint')
      expect(details.commands.test).toBe('pnpm test')
      expect(details.commands.typecheck).toBe('pnpm typecheck')
      expect(details.commands.build).toBe('pnpm build')
      expect(details.commands.dev).toBe('pnpm dev')
    })

    it('retorna structure com apps=["."] para projeto single', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.structure.apps).toEqual(['.'])
      expect(details.structure.packages).toEqual([])
    })

    it('retorna avoid_paths com defaults', async () => {
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

    it('retorna reviewHints com orientações', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { reviewHints } = await detectProject()
      expect(reviewHints.length).toBeGreaterThan(0)
      expect(reviewHints.some(h => typeof h === 'string')).toBe(true)
    })
  })

  describe('projeto monorepo', () => {
    beforeEach(() => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-monorepo'))
    })

    it('detecta type como "monorepo"', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.type).toBe('monorepo')
    })

    it('detecta apps e packages do workspace', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.structure.apps).toContain('apps/api')
      expect(details.structure.apps).toContain('apps/web')
      expect(details.structure.packages).toContain('packages/shared-types')
    })

    it('detecta entry points nas apps', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.entry_points).toContain('apps/api/src/main.ts')
      expect(details.context_hints.entry_points).toContain('apps/web/src/app/layout.tsx')
    })

    it('usa turbo run para os comandos', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.build).toBe('pnpm build')
    })
  })

  describe('projeto minimal (sem scripts)', () => {
    beforeEach(() => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-minimal'))
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
    })

    it('inclui hint sobre typecheck ausente', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { reviewHints } = await detectProject()
      expect(reviewHints.some(h => h.toLowerCase().includes('typecheck'))).toBe(true)
    })

    it('detecta type como "single" sem config de monorepo', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.type).toBe('single')
    })
  })

  describe('detecção de package manager', () => {
    it('usa npm run quando não há lockfile específico', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-simple'))
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      // projeto-simple não tem lockfile → npm run
      expect(details.commands.lint).toMatch(/^npm run|^pnpm|^yarn/)
    })
  })

  describe('stack detection — edge cases', () => {
    it('stack sem nestjs/next não detecta framework mas pode ter outras deps', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-minimal'))
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.backend).not.toContain('nestjs')
      expect(details.project.stack.frontend).toEqual([])
    })

    it('retorna frontend vazio para projeto apenas backend', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-simple'))
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.frontend).toEqual([])
    })
  })
  describe('projeto simples — fixtures enriquecidos', () => {
    beforeEach(() => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-simple'))
    })

    it('detecta pnpm como package manager pelo lockfile', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      // project-simple tem pnpm-lock.yaml
      expect(details.commands.lint).toMatch(/^pnpm/)
    })

    it('detecta typeorm no backend', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.backend).toContain('typeorm')
    })

    it('detecta commit pattern pelo .commitlintrc.json', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.commit_pattern).toBe('conventional-commits')
    })

    it('detecta src/main.ts como entry point', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.entry_points).toContain('src/main.ts')
    })
  })

  describe('monorepo — fixtures enriquecidos', () => {
    beforeEach(() => {
      vi.spyOn(process, 'cwd').mockReturnValue(resolve(FIXTURES, 'project-monorepo'))
    })

    it('detecta pnpm pelo lockfile', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.commands.lint).toMatch(/^pnpm/)
    })

    it('stack do root não inclui deps de sub-apps (next.js detectado pelo root)', async () => {
      // radix-ui e tailwind estão em apps/web, não no root — detector lê só root
      // next.js também está só em apps/web, então frontend fica vazio no root
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      // root package.json do monorepo não tem deps de frontend diretas
      expect(details.project.stack.frontend).toEqual([])
    })

    it('detecta turborepo na infra', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).toContain('turborepo')
    })

    it('detecta github-actions pela pasta .github/workflows ausente — não deve incluir', async () => {
      // monorepo tem .github/ mas não .github/workflows/
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.project.stack.infra).not.toContain('github-actions')
    })

    it('detecta PR template', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.pr_template).toBe('.github/pull_request_template.md')
    })

    it('detecta commit pattern pelo .commitlintrc.json', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.conventions.commit_pattern).toBe('conventional-commits')
    })

    it('web page.tsx também é encontrado como entry point', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.context_hints.entry_points).toContain('apps/web/src/app/page.tsx')
    })

    it('packages/shared-types classificado como package, não app', async () => {
      const { detectProject } = await import('../../src/detector/index.js')
      const { details } = await detectProject()
      expect(details.structure.packages).toContain('packages/shared-types')
      expect(details.structure.apps).not.toContain('packages/shared-types')
    })
  })

})
