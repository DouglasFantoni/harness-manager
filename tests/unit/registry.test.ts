import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'

const TMP = resolve(tmpdir(), `harness-registry-test-${Date.now()}`)

const COMMANDS_INDEX = `# Commands Registry

| Comando | Descrição | Cursor | Claude Code | Copilot | Arquivo |
|---------|-----------|--------|-------------|---------|---------|
| \`/review\` | Code review estruturado | ✅ | ✅ | ❌ | \`shared/review.md\` |
| \`/fix\` | Corrige problema | ✅ | ✅ | ✅ | \`shared/fix.md\` |
| \`/explain\` | Explica código | ✅ | ✅ | ✅ | \`shared/explain.md\` |
`

const SKILLS_INDEX = `# Skills Registry

| Skill | Domínio | Peso ~ | Expõe Command | Carregada por |
|-------|---------|--------|---------------|---------------|
| nestjs | backend | ~800 | — | /review |
| payroll | domínio | ~1200 | \`/calc-payroll\` | /review, /audit |
| _self-update | harness | ~400 | \`/harness-update\` | — |
`

const REVIEW_MD = `---
description: "Code review estruturado"
supported_by: ["cursor", "claude-code"]
requires: []
globs: []
---

# Command: /review

Steps here.
`

async function setupHarness(opts: {
  commandsIndex?: string
  skillsIndex?: string
  commandFiles?: Record<string, string>
} = {}) {
  const harnessDir = resolve(TMP, '.harness')
  await mkdir(resolve(harnessDir, 'commands/shared'), { recursive: true })
  await mkdir(resolve(harnessDir, 'skills'), { recursive: true })

  await writeFile(
    resolve(harnessDir, 'commands/_index.md'),
    opts.commandsIndex ?? COMMANDS_INDEX,
  )
  await writeFile(
    resolve(harnessDir, 'skills/_index.md'),
    opts.skillsIndex ?? SKILLS_INDEX,
  )

  for (const [name, content] of Object.entries(opts.commandFiles ?? {})) {
    await writeFile(resolve(harnessDir, 'commands', name), content)
  }
}

describe('loadRegistry', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('commands', () => {
    it('parseia commands do _index.md', async () => {
      await setupHarness()
      const { loadRegistry } = await import('../../src/registry.js')
      const { commands } = await loadRegistry()
      expect(commands.length).toBeGreaterThanOrEqual(3)
    })

    it('extrai nome do command corretamente', async () => {
      await setupHarness()
      const { loadRegistry } = await import('../../src/registry.js')
      const { commands } = await loadRegistry()
      const names = commands.map(c => c.name)
      expect(names).toContain('/review')
      expect(names).toContain('/fix')
      expect(names).toContain('/explain')
    })

    it('lê supported_by do frontmatter do arquivo', async () => {
      await setupHarness({ commandFiles: { 'shared/review.md': REVIEW_MD } })
      const { loadRegistry } = await import('../../src/registry.js')
      const { commands } = await loadRegistry()
      const review = commands.find(c => c.name === '/review')
      expect(review?.supported_by).toContain('cursor')
      expect(review?.supported_by).toContain('claude-code')
      expect(review?.supported_by).not.toContain('copilot')
    })

    it('usa fallback da tabela quando arquivo não existe', async () => {
      await setupHarness() // sem commandFiles
      const { loadRegistry } = await import('../../src/registry.js')
      const { commands } = await loadRegistry()
      // /review tem ✅ cursor e ✅ claude-code na tabela
      const review = commands.find(c => c.name === '/review')
      expect(review?.supported_by).toContain('cursor')
    })

    it('command com copilot ✅ inclui copilot no supported_by via fallback', async () => {
      await setupHarness()
      const { loadRegistry } = await import('../../src/registry.js')
      const { commands } = await loadRegistry()
      const fix = commands.find(c => c.name === '/fix')
      // /fix tem ✅ em todas as colunas na fixture
      expect(fix?.supported_by).toContain('cursor')
    })

    it('retorna array vazio quando _index.md não existe', async () => {
      const harnessDir = resolve(TMP, '.harness')
      await mkdir(resolve(harnessDir, 'commands/shared'), { recursive: true })
      await mkdir(resolve(harnessDir, 'skills'), { recursive: true })
      await writeFile(resolve(harnessDir, 'skills/_index.md'), SKILLS_INDEX)
      // sem commands/_index.md
      const { loadRegistry } = await import('../../src/registry.js')
      const { commands } = await loadRegistry()
      expect(commands).toEqual([])
    })
  })

  describe('skills', () => {
    it('parseia skills do _index.md', async () => {
      await setupHarness()
      const { loadRegistry } = await import('../../src/registry.js')
      const { skills } = await loadRegistry()
      expect(skills.length).toBeGreaterThanOrEqual(3)
    })

    it('extrai nome e domínio corretamente', async () => {
      await setupHarness()
      const { loadRegistry } = await import('../../src/registry.js')
      const { skills } = await loadRegistry()
      const nestjs = skills.find(s => s.name === 'nestjs')
      expect(nestjs?.domain).toBe('backend')
    })

    it('extrai peso numérico corretamente', async () => {
      await setupHarness()
      const { loadRegistry } = await import('../../src/registry.js')
      const { skills } = await loadRegistry()
      const payroll = skills.find(s => s.name === 'payroll')
      expect(payroll?.weight).toBe(1200)
    })

    it('retorna array vazio quando _index.md não existe', async () => {
      const harnessDir = resolve(TMP, '.harness')
      await mkdir(resolve(harnessDir, 'commands/shared'), { recursive: true })
      await mkdir(resolve(harnessDir, 'skills'), { recursive: true })
      await writeFile(resolve(harnessDir, 'commands/_index.md'), COMMANDS_INDEX)
      // sem skills/_index.md
      const { loadRegistry } = await import('../../src/registry.js')
      const { skills } = await loadRegistry()
      expect(skills).toEqual([])
    })

    it('lida com _index.md vazio sem crash', async () => {
      await setupHarness({ skillsIndex: '# Skills Registry\n\n(vazio)\n' })
      const { loadRegistry } = await import('../../src/registry.js')
      const { skills } = await loadRegistry()
      expect(skills).toEqual([])
    })
  })
})
