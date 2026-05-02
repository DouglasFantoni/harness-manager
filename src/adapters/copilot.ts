import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve } from 'path'
import matter from 'gray-matter'
import { resolvePlaceholders } from '../resolver.js'
import type { ToolConfig, ProjectDetails, Registry, AdapterResult } from '../types.js'

const ROOT = process.cwd()
const HARNESS_ROOT = resolve(ROOT, '.harness')

export class CopilotAdapter {
  constructor(
    private toolConfig: ToolConfig,
    private project: ProjectDetails,
    private registry: Registry,
  ) {}

  async generate(dryRun = false): Promise<AdapterResult> {
    const sections: string[] = []

    sections.push(this.buildHeader())
    sections.push(await this.loadSection('core/rules.md', '## Regras Globais'))
    sections.push(await this.loadSection('core/context.md', '## Contexto do Projeto'))
    sections.push(await this.loadSection('hooks/pre-task.md', '## Antes de Qualquer Task'))

    // Copilot tem budget pequeno — só lista commands, não inclui conteúdo completo
    sections.push(await this.buildCommandsSummary())

    const content = sections.filter(Boolean).join('\n\n---\n\n')
    const resolved = resolvePlaceholders(content, this.project)

    const outputPath = resolve(ROOT, this.toolConfig.context_file!)

    if (!dryRun) {
      await mkdir(resolve(outputPath, '..'), { recursive: true })
      await writeFile(outputPath, resolved, 'utf-8')
    }

    return { files: [outputPath] }
  }

  private buildHeader(): string {
    return `# GitHub Copilot Instructions — ${this.project.project.name}

> Gerado pelo harness sync. Não edite manualmente.
> Fonte: \`.harness/\``
  }

  private async buildCommandsSummary(): Promise<string> {
    // Copilot não suporta slash commands — apenas lista o que existe
    const supported = this.registry.commands.filter(cmd =>
      cmd.supported_by.includes('copilot')
    )

    if (!supported.length) return ''

    const lines = ['## Comandos disponíveis (invocar por descrição)']
    for (const cmd of supported) {
      lines.push(`- **${cmd.name}**: ${cmd.description}`)
    }
    return lines.join('\n')
  }

  private async loadSection(relativePath: string, title: string): Promise<string> {
    const raw = await readFile(resolve(HARNESS_ROOT, relativePath), 'utf-8').catch(() => null)
    if (!raw) return ''
    const { content } = matter(raw)
    return `${title}\n\n${content.trim()}`
  }
}
