import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve } from 'path'
import matter from 'gray-matter'
import { resolvePlaceholders } from '../resolver.js'
import type { ToolConfig, ProjectDetails, Registry, AdapterResult } from '../types.js'

function getRoot() { return process.cwd() }
function harnessRoot() { return resolve(getRoot(), '.harness') }

export class ClaudeCodeAdapter {
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
    sections.push(await this.buildSkillsIndex())
    sections.push(await this.loadSection('hooks/pre-task.md', '## Pre-Task Hook'))
    sections.push(await this.loadSection('hooks/on-error.md', '## On-Error Hook'))
    sections.push([
      '## Outros Hooks',
      'Consulte `.harness/hooks/` para: `post-task`, `on-ambiguity`, `on-skill-load`, `on-command`',
    ].join('\n'))
    sections.push(await this.buildCommands())

    const content = sections.filter(Boolean).join('\n\n---\n\n')
    const resolved = resolvePlaceholders(content, this.project)

    const outputPath = resolve(getRoot(), this.toolConfig.context_file!)
    const generatedPath = resolve(harnessRoot(), 'commands/generated/claude-code/CLAUDE.md')

    if (!dryRun) {
      await mkdir(resolve(generatedPath, '..'), { recursive: true })
      await writeFile(outputPath, resolved, 'utf-8')
      await writeFile(generatedPath, resolved, 'utf-8')
    }

    return { files: [outputPath, generatedPath] }
  }

  private buildHeader(): string {
    return `# CLAUDE.md — ${this.project.project.name}

> Gerado pelo harness sync. Não edite manualmente.
> Para atualizar: \`pnpm harness:sync\`
> Fonte: \`.harness/\`

## Harness

Este projeto usa o [AI Harness Framework](https://github.com/DouglasFantoni/harness-manager).

Antes de qualquer task, siga \`.harness/hooks/pre-task.md\`.
Skills disponíveis em \`.harness/skills/_index.md\`.`
  }

  private async buildSkillsIndex(): Promise<string> {
    const content = await readFile(resolve(harnessRoot(), 'skills/_index.md'), 'utf-8').catch(() => '')
    return `## Skills\n\n${content}\n\n> Para detalhes de uma skill: \`.harness/skills/{domain}/SKILL.md\``
  }

  private async buildCommands(): Promise<string> {
    const supported = this.registry.commands.filter(cmd =>
      cmd.supported_by.includes('claude-code')
    )

    const lines = ['## Slash Commands']

    for (const cmd of supported) {
      const filePath = resolve(harnessRoot(), 'commands', cmd.file)
      const raw = await readFile(filePath, 'utf-8').catch(() => null)
      if (!raw) continue

      const { content } = matter(raw)
      lines.push(resolvePlaceholders(content, this.project))
    }

    return lines.join('\n\n')
  }

  private async loadSection(relativePath: string, title: string): Promise<string> {
    const raw = await readFile(resolve(harnessRoot(), relativePath), 'utf-8').catch(() => null)
    if (!raw) return ''
    const { content } = matter(raw)
    return `${title}\n\n${content.trim()}`
  }
}
