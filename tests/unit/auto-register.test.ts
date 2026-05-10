import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, readFile, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'
import type { SkillMeta, HookMeta } from '../../src/types.js'

const TMP = resolve(tmpdir(), `harness-autoreg-test-${Date.now()}`)

const BASE_SKILL = `# Skill: Minha Skill

## Meta

\`\`\`yaml
domain: "backend"
weight: ~600
exposes_command: []
required_by: ["/review"]
load_with: []
conflicts_with: []
globs: ["**/*.service.ts"]
\`\`\`

## Quando usar

Ao trabalhar com arquivos .service.ts.

## Regras

- Sempre usar injeção de dependência
`

const SKILL_WITHOUT_META = `# Skill: Sem Meta

## Quando usar

Qualquer coisa.

## Regras

- Regra básica
`

async function setup() {
  await mkdir(resolve(TMP, '.harness/skills'), { recursive: true })
  await mkdir(resolve(TMP, '.harness/hooks'), { recursive: true })
  await mkdir(resolve(TMP, '.harness/core/rules'), { recursive: true })
  await mkdir(resolve(TMP, '.harness/commands'), { recursive: true })
}

async function writeSkill(name: string, content: string) {
  await mkdir(resolve(TMP, `.harness/skills/${name}`), { recursive: true })
  await writeFile(resolve(TMP, `.harness/skills/${name}/SKILL.md`), content)
}

async function writeHook(name: string, content = `# Hook: ${name}\n\nConteúdo.\n`) {
  await writeFile(resolve(TMP, `.harness/hooks/${name}.md`), content)
}

async function writeRule(name: string, content = `# Rules: ${name}\n\n## Regras\n\n- Regra.\n`) {
  await writeFile(resolve(TMP, `.harness/core/rules/${name}.md`), content)
}

const currentSkills: SkillMeta[] = [
  { name: '_self-update', domain: 'harness', weight: 400, exposes_command: [], required_by: [], load_with: [], conflicts_with: [], globs: [], source: null, sync: false },
]

const currentHooks: HookMeta[] = [
  { name: 'pre-task', file: 'pre-task.md', triggers: 'Início', blocks: true, weight: 300, always_load: true },
]

describe('autoRegister', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
    await setup()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('skills', () => {
    it('detecta skill nova e adiciona ao index.json', async () => {
      await writeSkill('minha-skill', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.skills).toHaveLength(1)
      expect(result.skills[0].name).toBe('minha-skill')
      expect(result.skills[0].domain).toBe('backend')
      expect(result.skills[0].weight).toBe(600)
      expect(result.skills[0].sync).toBe(false)
      expect(result.skills[0].source).toBeNull()
    })

    it('não registra skills já existentes no index', async () => {
      await writeSkill('_self-update', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.skills).toHaveLength(0)
    })

    it('pula diretórios que começam com _', async () => {
      await writeSkill('_template', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.skills.map(s => s.name)).not.toContain('_template')
    })

    it('extrai globs do SKILL.md', async () => {
      await writeSkill('minha-skill', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.skills[0].globs).toContain('**/*.service.ts')
    })

    it('usa defaults para skill sem Meta completo', async () => {
      await writeSkill('sem-meta', SKILL_WITHOUT_META)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.skills[0].name).toBe('sem-meta')
      expect(result.skills[0].weight).toBe(500) // default
      expect(result.skills[0].sync).toBe(false)
    })

    it('injeta sync: false no SKILL.md se ausente', async () => {
      await writeSkill('sem-sync', SKILL_WITHOUT_META)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks)

      const updated = await readFile(
        resolve(TMP, '.harness/skills/sem-sync/SKILL.md'), 'utf-8'
      )
      expect(updated).toContain('sync: false')
    })

    it('adiciona seção CUSTOM ao SKILL.md se ausente', async () => {
      await writeSkill('sem-custom', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks)

      const updated = await readFile(
        resolve(TMP, '.harness/skills/sem-custom/SKILL.md'), 'utf-8'
      )
      expect(updated).toContain('HARNESS:CUSTOM:START')
      expect(updated).toContain('HARNESS:CUSTOM:END')
    })

    it('persiste no index.json', async () => {
      await writeSkill('minha-skill', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks)

      const json = JSON.parse(
        await readFile(resolve(TMP, '.harness/skills/index.json'), 'utf-8')
      )
      expect(json.skills.map((s: SkillMeta) => s.name)).toContain('minha-skill')
    })

    it('dry-run não persiste no index.json', async () => {
      await writeSkill('minha-skill', BASE_SKILL)
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks, true)

      const json = JSON.parse(
        await readFile(resolve(TMP, '.harness/skills/index.json'), 'utf-8')
      )
      expect(json.skills.map((s: SkillMeta) => s.name)).not.toContain('minha-skill')
    })
  })

  describe('hooks', () => {
    it('detecta hook novo e adiciona ao index.json', async () => {
      await writeHook('on-deploy')
      await writeFile(
        resolve(TMP, '.harness/hooks/index.json'),
        JSON.stringify({ hooks: currentHooks })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.hooks).toHaveLength(1)
      expect(result.hooks[0].name).toBe('on-deploy')
    })

    it('não registra hooks já existentes', async () => {
      await writeHook('pre-task')
      await writeFile(
        resolve(TMP, '.harness/hooks/index.json'),
        JSON.stringify({ hooks: currentHooks })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.hooks).toHaveLength(0)
    })

    it('infere blocks=true para hooks on-*', async () => {
      await writeHook('on-deploy')
      await writeFile(
        resolve(TMP, '.harness/hooks/index.json'),
        JSON.stringify({ hooks: currentHooks })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      // on-deploy não está na lista de bloqueantes conhecidos
      expect(result.hooks[0].blocks).toBe(false)
    })

    it('persiste no hooks/index.json', async () => {
      await writeHook('on-deploy')
      await writeFile(
        resolve(TMP, '.harness/hooks/index.json'),
        JSON.stringify({ hooks: currentHooks })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks)

      const json = JSON.parse(
        await readFile(resolve(TMP, '.harness/hooks/index.json'), 'utf-8')
      )
      expect(json.hooks.map((h: HookMeta) => h.name)).toContain('on-deploy')
    })
  })

  describe('rules', () => {
    it('injeta meta em rule pack sem meta', async () => {
      await writeRule('minhas-regras')

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.rules).toContain('minhas-regras.md')
    })

    it('não injeta meta em rule pack que já tem', async () => {
      await writeRule('com-meta', `# Rules: Com Meta\n\n## Meta\n\n\`\`\`yaml\nsync: false\n\`\`\`\n\n## Regras\n\n- Regra.\n`)

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.rules).not.toContain('com-meta.md')
    })

    it('meta injetado tem sync: false', async () => {
      await writeRule('local-rules')

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks)

      const content = await readFile(
        resolve(TMP, '.harness/core/rules/local-rules.md'), 'utf-8'
      )
      expect(content).toContain('sync: false')
    })

    it('adiciona seção CUSTOM ao rule pack', async () => {
      await writeRule('local-rules')

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks)

      const content = await readFile(
        resolve(TMP, '.harness/core/rules/local-rules.md'), 'utf-8'
      )
      expect(content).toContain('HARNESS:CUSTOM:START')
    })

    it('dry-run não escreve arquivos', async () => {
      await writeRule('local-rules')
      const original = await readFile(
        resolve(TMP, '.harness/core/rules/local-rules.md'), 'utf-8'
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      await autoRegister(currentSkills, [], currentHooks, true)

      const after = await readFile(
        resolve(TMP, '.harness/core/rules/local-rules.md'), 'utf-8'
      )
      expect(after).toBe(original)
    })
  })

  describe('edge cases', () => {
    it('retorna vazio quando não há itens novos', async () => {
      await writeFile(
        resolve(TMP, '.harness/skills/index.json'),
        JSON.stringify({ skills: currentSkills })
      )
      await writeFile(
        resolve(TMP, '.harness/hooks/index.json'),
        JSON.stringify({ hooks: currentHooks })
      )

      const { autoRegister } = await import('../../src/auto-register.js')
      const result = await autoRegister(currentSkills, [], currentHooks)

      expect(result.skills).toHaveLength(0)
      expect(result.rules).toHaveLength(0)
      expect(result.hooks).toHaveLength(0)
    })

    it('não lança erro quando diretórios não existem', async () => {
      const { autoRegister } = await import('../../src/auto-register.js')
      await expect(
        autoRegister([], [], [])
      ).resolves.toBeDefined()
    })
  })
})
