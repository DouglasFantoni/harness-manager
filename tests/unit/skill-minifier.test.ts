import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, readFile, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'

const TMP = resolve(tmpdir(), `harness-minifier-test-${Date.now()}`)

const FULL_SKILL = `# Skill: Payroll

## Meta

\`\`\`yaml
domain: "domínio"
weight: ~900
exposes_command: ["/calc-payroll"]
required_by: ["/review"]
load_with: ["fiscal"]
conflicts_with: []
globs: ["**/*.payroll.ts"]
\`\`\`

## Quando usar

Ao criar, editar ou revisar qualquer lógica de cálculo de folha de pagamento,
incluindo INSS, IRRF, FGTS, férias, 13º e rescisão.

## Quando NÃO usar

Para lógicas de emissão fiscal (NFS-e). Use a skill \`fiscal\`.

## Contexto essencial

- Tabelas INSS/IRRF mudam anualmente
- O pacote canônico é \`packages/tax-calculator/src/tax-calculator.ts\`
- O padrão \`taxSnapshot\` deve ser usado em todo cálculo persistido

## Regras

- Nunca calcular INSS com alíquota flat
- Nunca persistir um cálculo sem gravar o \`taxSnapshot\` junto
- Sempre usar o tipo \`PayrollResult\` de \`packages/shared-types\`

## Padrões

- Ver \`examples/good/progressive-inss.ts\` para implementação correta

## Checklist de execução

- [ ] Tabela vigente validada?
- [ ] taxSnapshot incluído no resultado?
- [ ] Tipo PayrollResult usado?

## Referências

- \`memory/decisions.md#tax-package\`
- \`memory/mistakes.md#inss-flat-rate\`
`

async function setupSkill(name: string, content: string) {
  const skillDir = resolve(TMP, '.harness/skills', name)
  await mkdir(skillDir, { recursive: true })
  await writeFile(resolve(skillDir, 'SKILL.md'), content)
}

describe('minify (unit)', () => {
  it('remove ## Meta e todo seu conteúdo incluindo o yaml block', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify(FULL_SKILL)
    expect(result).not.toContain('## Meta')
    expect(result).not.toContain('```yaml')
    expect(result).not.toContain('weight: ~900')
    expect(result).not.toContain('exposes_command')
    expect(result).not.toContain('globs:')
  })

  it('remove ## Checklist de execução e todo seu conteúdo', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify(FULL_SKILL)
    expect(result).not.toContain('## Checklist')
    expect(result).not.toContain('- [ ] Tabela vigente')
    expect(result).not.toContain('- [ ] taxSnapshot')
  })

  it('remove ## Referências e todo seu conteúdo', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify(FULL_SKILL)
    expect(result).not.toContain('## Referências')
    expect(result).not.toContain('memory/decisions.md#tax-package')
    expect(result).not.toContain('memory/mistakes.md#inss-flat-rate')
  })

  it('mantém todas as seções essenciais para runtime', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify(FULL_SKILL)
    expect(result).toContain('## Quando usar')
    expect(result).toContain('## Quando NÃO usar')
    expect(result).toContain('## Contexto essencial')
    expect(result).toContain('## Regras')
    expect(result).toContain('## Padrões')
  })

  it('mantém conteúdo das regras intacto', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify(FULL_SKILL)
    expect(result).toContain('Nunca calcular INSS com alíquota flat')
    expect(result).toContain('taxSnapshot')
    expect(result).toContain('PayrollResult')
  })

  it('resultado é menor que o original', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify(FULL_SKILL)
    expect(result.length).toBeLessThan(FULL_SKILL.length)
  })

  it('não altera conteúdo dentro de blocos de código fora do Meta', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const withCode = FULL_SKILL + `\n## Protocolo\n\n\`\`\`typescript\n// Este código deve ser mantido\nconst x = calc()\n\`\`\`\n`
    const result = minify(withCode)
    expect(result).toContain('```typescript')
    expect(result).toContain('// Este código deve ser mantido')
    expect(result).toContain('const x = calc()')
  })

  it('remove comentários HTML', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const withComment = FULL_SKILL + '\n<!-- Este comentário não deve aparecer -->\n'
    const result = minify(withComment)
    expect(result).not.toContain('Este comentário não deve aparecer')
  })

  it('colapsa linhas em branco duplicadas', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const withBlanks = FULL_SKILL.replace(/\n\n/g, '\n\n\n\n')
    const result = minify(withBlanks)
    expect(result).not.toContain('\n\n\n')
  })

  it('não deixa linhas em branco no início ou fim', async () => {
    const { minify } = await import('../../src/skill-minifier.js')
    const result = minify('\n\n' + FULL_SKILL + '\n\n\n')
    expect(result.startsWith('\n')).toBe(false)
    expect(result.endsWith('\n\n')).toBe(false)
  })
})

describe('generateSkillMinFiles', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    vi.resetModules()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('geração básica', () => {
    it('gera SKILL.min.md para cada skill', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles()
      expect(results).toHaveLength(1)
      expect(results[0].path).toContain('SKILL.min.md')
      expect(results[0].changed).toBe(true)
    })

    it('SKILL.min.md gerado não contém ## Meta', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).not.toContain('## Meta')
      expect(content).not.toContain('weight: ~900')
    })

    it('SKILL.min.md gerado não contém ## Checklist', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).not.toContain('## Checklist')
      expect(content).not.toContain('- [ ] Tabela vigente')
    })

    it('reporta tokensBefore e tokensAfter', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles()
      expect(results[0].tokensBefore).toBeGreaterThan(0)
      expect(results[0].tokensAfter).toBeGreaterThan(0)
      expect(results[0].tokensAfter).toBeLessThan(results[0].tokensBefore)
    })

    it('redução de tokens é maior que 10%', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles()
      const reduction = 1 - results[0].tokensAfter / results[0].tokensBefore
      expect(reduction).toBeGreaterThan(0.1)
    })
  })

  describe('idempotência', () => {
    it('changed=false na segunda execução sem mudanças', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const second = await generateSkillMinFiles()
      expect(second[0].changed).toBe(false)
    })

    it('changed=true quando SKILL.md é atualizado', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      await writeFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.md'),
        FULL_SKILL + '\n## Nota\n\nConteúdo novo.\n'
      )
      const second = await generateSkillMinFiles()
      expect(second[0].changed).toBe(true)
    })
  })

  describe('dry-run', () => {
    it('não escreve arquivo mas retorna resultado', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles(true)
      expect(results[0].changed).toBe(true)
      const exists = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      ).then(() => true).catch(() => false)
      expect(exists).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('pula _template', async () => {
      await setupSkill('_template', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles()
      expect(results).toHaveLength(0)
    })

    it('processa múltiplas skills', async () => {
      await setupSkill('payroll', FULL_SKILL)
      await setupSkill('fiscal', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles()
      expect(results).toHaveLength(2)
    })

    it('retorna array vazio se skills/ não existe', async () => {
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const results = await generateSkillMinFiles()
      expect(results).toEqual([])
    })
  })
})

describe('countTokens', () => {
  it('retorna contagem maior que zero para texto não vazio', async () => {
    const { countTokens } = await import('../../src/skill-minifier.js')
    const count = await countTokens('Nunca calcular INSS com alíquota flat.')
    expect(count).toBeGreaterThan(0)
  })

  it('texto maior tem mais tokens', async () => {
    const { countTokens } = await import('../../src/skill-minifier.js')
    const short = await countTokens('Regra simples.')
    const long = await countTokens('Esta é uma regra muito mais longa com muito mais conteúdo e detalhes adicionais.')
    expect(long).toBeGreaterThan(short)
  })

  it('retorna 0 para string vazia', async () => {
    const { countTokens } = await import('../../src/skill-minifier.js')
    const count = await countTokens('')
    expect(count).toBe(0)
  })
})
