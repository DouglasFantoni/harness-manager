import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { writeFile, mkdir, readFile, rm } from 'fs/promises'
import { resolve } from 'path'
import { tmpdir } from 'os'

const TMP = resolve(tmpdir(), `harness-minifier-test-${Date.now()}`)

const FULL_SKILL = `# Skill: Payroll

> Copie este arquivo para \`skills/{domain}/SKILL.md\` e preencha todos os campos.
> Depois adicione uma entrada em \`skills/_index.md\`.

## Meta

\`\`\`yaml
domain: "domínio"
weight: ~900
exposes_command: ["/calc-payroll"]
required_by: ["/review"]
load_with: ["fiscal"]
conflicts_with: []
globs: ["**/*.payroll.ts", "apps/api/src/payroll/**"]
\`\`\`

## Quando usar

Ao criar, editar ou revisar qualquer lógica de cálculo de folha de pagamento,
incluindo INSS, IRRF, FGTS, férias, 13º e rescisão.

## Quando NÃO usar

Para lógicas de emissão fiscal (NFS-e). Use a skill \`fiscal\`.

## Contexto essencial

- Tabelas INSS/IRRF mudam anualmente — sempre validar contra decisions.md
- O pacote canônico é \`packages/tax-calculator/src/tax-calculator.ts\`
- O padrão \`taxSnapshot\` deve ser usado em todo cálculo persistido

## Regras

- Nunca calcular INSS com alíquota flat
- Nunca persistir um cálculo sem gravar o \`taxSnapshot\` junto
- Sempre usar o tipo \`PayrollResult\` de \`packages/shared-types\`

## Padrões

- Ver \`examples/good/progressive-inss.ts\` para implementação correta
- Ver \`examples/bad/flat-rate-inss.ts\` para o anti-padrão

## Checklist de execução

- [ ] Tabela vigente validada?
- [ ] \`taxSnapshot\` incluído no resultado?
- [ ] Tipo \`PayrollResult\` usado?
- [ ] \`pnpm test\` e \`pnpm typecheck\` passando?

## Referências

- \`memory/decisions.md#tax-package\`
- \`memory/mistakes.md#inss-flat-rate\`
`

async function setupSkill(name: string, content: string) {
  const skillDir = resolve(TMP, '.harness/skills', name)
  await mkdir(skillDir, { recursive: true })
  await writeFile(resolve(skillDir, 'SKILL.md'), content)
}

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
      const files = await generateSkillMinFiles()
      expect(files).toHaveLength(1)
      expect(files[0]).toContain('SKILL.min.md')
    })

    it('SKILL.min.md é menor que SKILL.md', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const original = FULL_SKILL.length
      const minified = (await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )).length
      expect(minified).toBeLessThan(original)
    })

    it('remove a seção ## Meta', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).not.toContain('## Meta')
      expect(content).not.toContain('```yaml')
      expect(content).not.toContain('weight: ~900')
    })

    it('remove a seção ## Checklist de execução', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).not.toContain('## Checklist de execução')
      expect(content).not.toContain('- [ ] Tabela vigente validada?')
    })

    it('remove a seção ## Referências', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).not.toContain('## Referências')
      expect(content).not.toContain('memory/decisions.md#tax-package')
    })

    it('mantém seções essenciais para a IA', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).toContain('## Quando usar')
      expect(content).toContain('## Quando NÃO usar')
      expect(content).toContain('## Contexto essencial')
      expect(content).toContain('## Regras')
      expect(content).toContain('## Padrões')
    })

    it('mantém conteúdo das regras', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).toContain('Nunca calcular INSS com alíquota flat')
      expect(content).toContain('taxSnapshot')
    })
  })

  describe('idempotência', () => {
    it('não regenera se o conteúdo não mudou', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const first = await generateSkillMinFiles()
      expect(first).toHaveLength(1)
      const second = await generateSkillMinFiles()
      expect(second).toHaveLength(0)
    })

    it('regenera se SKILL.md foi atualizado', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      // Modifica o SKILL.md
      await writeFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.md'),
        FULL_SKILL + '\n## Nota extra\n\nConteúdo novo.\n'
      )
      const second = await generateSkillMinFiles()
      expect(second).toHaveLength(1)
    })
  })

  describe('dry-run', () => {
    it('não escreve arquivo em dry-run', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles(true)
      const exists = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      ).then(() => true).catch(() => false)
      expect(exists).toBe(false)
    })

    it('retorna os paths mesmo em dry-run', async () => {
      await setupSkill('payroll', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const files = await generateSkillMinFiles(true)
      expect(files).toHaveLength(1)
    })
  })

  describe('edge cases', () => {
    it('pula diretório _template', async () => {
      await setupSkill('_template', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const files = await generateSkillMinFiles()
      expect(files).toHaveLength(0)
    })

    it('processa múltiplas skills', async () => {
      await setupSkill('payroll', FULL_SKILL)
      await setupSkill('fiscal', FULL_SKILL)
      await setupSkill('nestjs', FULL_SKILL)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const files = await generateSkillMinFiles()
      expect(files).toHaveLength(3)
    })

    it('retorna array vazio se não há skills', async () => {
      await mkdir(resolve(TMP, '.harness/skills'), { recursive: true })
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      const files = await generateSkillMinFiles()
      expect(files).toHaveLength(0)
    })

    it('remove linhas em branco duplicadas', async () => {
      const withBlanks = FULL_SKILL.replace(/\n\n/g, '\n\n\n\n')
      await setupSkill('payroll', withBlanks)
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await generateSkillMinFiles()
      const content = await readFile(
        resolve(TMP, '.harness/skills/payroll/SKILL.min.md'), 'utf-8'
      )
      expect(content).not.toContain('\n\n\n')
    })

    it('lida sem crash quando skills/ não existe', async () => {
      const { generateSkillMinFiles } = await import('../../src/skill-minifier.js')
      await expect(generateSkillMinFiles()).resolves.toEqual([])
    })
  })
})
