import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve } from 'path'
import matter from 'gray-matter'
import { resolvePlaceholders } from '../resolver.js'
import type { ToolConfig, ProjectDetails, Registry, AdapterResult } from '../types.js'

function getRoot() { return process.cwd() }
function harnessRoot() { return resolve(getRoot(), '.harness') }

export class CursorAdapter {
  constructor(
    private toolConfig: ToolConfig,
    private project: ProjectDetails,
    private registry: Registry,
  ) {}

  async generate(dryRun = false): Promise<AdapterResult> {
    const files: string[] = []
    const rulesDir = resolve(getRoot(), this.toolConfig.rules_folder!)

    if (!dryRun) {
      await mkdir(rulesDir, { recursive: true })
    }

    // 1. Regra principal — alwaysApply: true
    const mainContent = await this.buildMainRule()
    const mainPath = resolve(rulesDir, 'harness-main.mdc')
    if (!dryRun) await writeFile(mainPath, mainContent, 'utf-8')
    files.push(mainPath)

    // 2. Uma .mdc por command suportado
    const supported = this.registry.commands.filter(cmd =>
      cmd.supported_by.includes('cursor')
    )

    for (const cmd of supported) {
      const filePath = resolve(harnessRoot(), 'commands', cmd.file)
      const raw = await readFile(filePath, 'utf-8').catch(() => null)
      if (!raw) continue

      const { data, content } = matter(raw)
      const resolved = resolvePlaceholders(content, this.project)

      const mdc = this.buildMdc({
        description: data.description ?? cmd.description,
        alwaysApply: false,
        globs: data.globs ?? [],
        content: resolved,
      })

      const cmdSlug = cmd.name.replace('/', '')
      const cmdPath = resolve(rulesDir, `cmd-${cmdSlug}.mdc`)
      if (!dryRun) await writeFile(cmdPath, mdc, 'utf-8')
      files.push(cmdPath)
    }

    return { files }
  }

  private async buildMainRule(): Promise<string> {
    const rules = await readFile(resolve(harnessRoot(), 'core/rules.md'), 'utf-8').catch(() => '')
    const { content } = matter(rules)

    return this.buildMdc({
      description: `Harness principal — ${this.project.project.name}`,
      alwaysApply: true,
      globs: [],
      content: `# Harness — ${this.project.project.name}

Antes de qualquer task, consulte \`.harness/hooks/pre-task.md\`.
Skills disponíveis em \`.harness/skills/_index.md\`.
Em caso de erro: \`.harness/hooks/on-error.md\`.

${content.trim()}`,
    })
  }

  private buildMdc(opts: {
    description: string
    alwaysApply: boolean
    globs: string[]
    content: string
  }): string {
    const globsStr = opts.globs.length ? JSON.stringify(opts.globs) : '[]'
    return `---
description: ${opts.description}
alwaysApply: ${opts.alwaysApply}
globs: ${globsStr}
---

${opts.content.trim()}`
  }
}
