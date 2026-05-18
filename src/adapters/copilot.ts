import { mkdir, readFile, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { resolve } from 'path'
import { DEFAULT_COPILOT_MIRROR_ROOT } from '../config.js'
import { loadAllRules } from '../harness-utils.js'
import { resolvePlaceholders } from '../resolver.js'
import type { AdapterResult, ProjectDetails, Registry, ToolConfig } from '../types.js'
import {
    buildCopilotHooksIndex,
    buildCopilotSkillsIndex,
    mirrorHarnessForCopilot,
} from './copilot-mirror.js'

function getRoot() { return process.cwd() }
function harnessRoot() { return resolve(getRoot(), '.harness') }

export class CopilotAdapter {
  constructor(
    private toolConfig: ToolConfig,
    private project: ProjectDetails,
    private registry: Registry,
  ) {}

  async generate(dryRun = false): Promise<AdapterResult> {
    const root = getRoot()
    const mirrorRootRel = this.copilotMirrorRootRel()

    const mirrorFiles = await mirrorHarnessForCopilot({
      projectRoot: root,
      mirrorRootRel,
      skills: this.registry.skills,
      hooks: this.registry.hooks,
      dryRun,
    })

    const sections: string[] = []
    sections.push(this.buildHeader(mirrorRootRel))
    sections.push(`## Regras Globais\n\n${await loadAllRules(harnessRoot())}`)
    sections.push(await this.loadGlossary())
    sections.push(await this.loadSection('core/context.md', '## Contexto do Projeto'))
    sections.push(buildCopilotHooksIndex(mirrorRootRel, this.registry.hooks))
    sections.push(buildCopilotSkillsIndex(mirrorRootRel, this.registry.skills))
    sections.push(await this.buildCommandsSummary())

    const content = sections.filter(Boolean).join('\n\n---\n\n')
    const resolved = resolvePlaceholders(content, this.project)

    const outputPath = resolve(root, this.toolConfig.context_file!)

    if (!dryRun) {
      await mkdir(resolve(outputPath, '..'), { recursive: true })
      await writeFile(outputPath, resolved, 'utf-8')
    }

    return { files: [...mirrorFiles, outputPath] }
  }

  private copilotMirrorRootRel(): string {
    const raw = this.toolConfig.copilot_mirror_root
    if (raw === undefined || raw === null) return DEFAULT_COPILOT_MIRROR_ROOT
    const s = raw.trim().replace(/\/+$/, '')
    return s || DEFAULT_COPILOT_MIRROR_ROOT
  }

  private buildHeader(mirrorRootRel: string): string {
    return `# GitHub Copilot Instructions — ${this.project.project.name}

> Gerado pelo harness sync. Não edite manualmente.
> Fonte: \`.harness/\` — espelho compacto em \`${mirrorRootRel}/\`

Copilot não usa slash commands; invoque workflows pela descrição (ex.: "explique este trecho" para /explain).
Antes de qualquer task, leia \`${mirrorRootRel}/hooks/pre-task.md\`.`
  }

  private async loadGlossary(): Promise<string> {
    const raw = await readFile(resolve(harnessRoot(), 'core/glossary.md'), 'utf-8').catch(() => null)
    if (!raw) return ''
    const { content } = matter(raw)
    const trimmed = content.trim()
    if (!trimmed || trimmed.startsWith('> Preencha')) return ''
    return `## Glossário\n\n${trimmed}`
  }

  private async buildCommandsSummary(): Promise<string> {
    const supported = this.registry.commands.filter(cmd =>
      cmd.supported_by.includes('copilot'),
    )

    if (!supported.length) {
      return [
        '## Comandos Harness',
        '',
        'Nenhum command marcado com `supported_by: copilot`. Adicione em `.harness/commands/shared/*.md` se quiser listá-los aqui.',
      ].join('\n')
    }

    const lines = [
      '## Comandos Harness (invocar por descrição)',
      '',
      'Peça explicitamente, ex.: "execute o fluxo /explain neste trecho".',
      '',
    ]
    for (const cmd of supported) {
      lines.push(`- **${cmd.name}**: ${cmd.description}`)
    }
    return lines.join('\n')
  }

  private async loadSection(relativePath: string, title: string): Promise<string> {
    const raw = await readFile(resolve(harnessRoot(), relativePath), 'utf-8').catch(() => null)
    if (!raw) return ''
    const { content } = matter(raw)
    const trimmed = content.trim()
    if (!trimmed) return ''
    return `${title}\n\n${trimmed}`
  }
}
