import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TMP = resolve(tmpdir(), `harness-skill-add-${Date.now()}`)

const SKILL_BODY = `# Skill: test

## Meta

\`\`\`yaml
version: "2.0.0"
domain: "backend"
\`\`\`

## Regras

- rule one
`

describe('runSkillAdd (remote registry)', () => {
  beforeEach(async () => {
    await mkdir(resolve(TMP, '.harness/skills'), { recursive: true })
    await writeFile(
      resolve(TMP, '.harness/harness.config.json'),
      JSON.stringify({
        version: '1.0.0',
        tools: {},
        context_strategy: { always_load: [], load_on_demand: [], never_load: [] },
        registry: {
          skills_base_url: 'https://registry.test/skills',
          rules_base_url: 'https://registry.test/rules',
          scopes: {
            acme: {
              skills_base_url: 'https://private.test/acme/skills',
              token_env: 'ACME_TOKEN',
            },
          },
        },
      }),
    )
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('private.test') && !process.env.ACME_TOKEN) {
        return { ok: false, status: 403, text: async () => '' }
      }
      return { ok: true, status: 200, text: async () => SKILL_BODY }
    }))
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    await rm(TMP, { recursive: true, force: true })
  })

  it('installs official skill from configured base URL', async () => {
    const { runSkillAdd } = await import('../../src/commands/skill-sync.js')
    await runSkillAdd(['nestjs'])

    const installed = await readFile(
      resolve(TMP, '.harness/skills/nestjs/SKILL.md'),
      'utf-8',
    )
    expect(installed).toContain('source: "https://registry.test/skills/nestjs/SKILL.md"')
    expect(installed).toContain('registry_ref: "nestjs"')
  })

  it('installs scoped skill under scope-name directory', async () => {
    process.env.ACME_TOKEN = 'secret'
    const { runSkillAdd } = await import('../../src/commands/skill-sync.js')
    await runSkillAdd(['@acme/payroll'])

    const installed = await readFile(
      resolve(TMP, '.harness/skills/acme-payroll/SKILL.md'),
      'utf-8',
    )
    expect(installed).toContain('https://private.test/acme/skills/payroll/SKILL.md')
    expect(installed).toContain('registry_ref: "@acme/payroll"')
    delete process.env.ACME_TOKEN
  })
})
