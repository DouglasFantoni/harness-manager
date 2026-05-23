import { mkdir, readFile, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { resolve } from 'path'
import { DEFAULT_AGENT_SKILLS_MIRROR_ROOT } from '../config.js'
import { loadAllRules } from '../harness-utils.js'
import { resolvePlaceholders } from '../resolver.js'
import type { AdapterResult, ProjectDetails, Registry, ToolConfig } from '../types.js'
import { generateCursorHooks } from './cursor-hooks.js'
import { mirrorHarnessAgentSkills } from './cursor-mirror-skills.js'
import { generateMcpRecommended } from './mcp-recommended.js'

function getRoot() { return process.cwd() }
function harnessRoot() { return resolve(getRoot(), '.harness') }

export interface CursorAdapterOptions {
  /**
   * When true, skips the legacy mirrorHarnessAgentSkills step.
   * Set by runSync when `config.skills.targets` is configured —
   * skills are already linked via symlink/copy at that point.
   */
  skipSkillsMirror?: boolean
}

export class CursorAdapter {
  constructor(
    private toolConfig: ToolConfig,
    private project: ProjectDetails,
    private registry: Registry,
    private options: CursorAdapterOptions = {},
  ) {}

  async generate(dryRun = false): Promise<AdapterResult> {
    const files: string[] = []
    const root = getRoot()
    const rulesDir = resolve(root, this.toolConfig.rules_folder!)

    // Skills mirror — skipped when skills.targets handles linking natively
    if (!this.options.skipSkillsMirror) {
      const mirrorRootRel = this.agentSkillsMirrorRootRel()
      const mirrorFiles = await mirrorHarnessAgentSkills({
        projectRoot: root,
        mirrorRootRel,
        dryRun,
      })
      files.push(...mirrorFiles)
    }

    const hookFiles = await generateCursorHooks({
      projectRoot: root,
      harnessHooks: this.registry.hooks,
      dryRun,
    })
    files.push(...hookFiles)

    if (this.toolConfig.supports_mcp) {
      const mcp = await generateMcpRecommended({ projectRoot: root, dryRun })
      files.push(mcp.jsonPath, mcp.docPath)
    }

    if (!dryRun) {
      await mkdir(rulesDir, { recursive: true })
    }

    // 1. Regra principal — alwaysApply: true, sem globs
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

    // 3. Lazy loading — uma .mdc por skill que declara globs
    //    Carregada automaticamente pelo Cursor quando o arquivo aberto
    //    corresponde ao glob, sem ocupar contexto em outros momentos
    for (const mapping of this.registry.skillGlobs) {
      const skillPath = resolve(harnessRoot(), `skills/${mapping.skill}/SKILL.md`)
      const raw = await readFile(skillPath, 'utf-8').catch(() => null)
      if (!raw) continue

      // Usa a versão minificada se existir, senão a completa
      const minPath = resolve(harnessRoot(), `skills/${mapping.skill}/SKILL.min.md`)
      const minRaw = await readFile(minPath, 'utf-8').catch(() => null)
      const content = minRaw ?? raw

      const mdc = this.buildMdc({
        description: mapping.description,
        alwaysApply: false,
        globs: [mapping.glob],
        content: `# Skill auto-carregada: ${mapping.skill}\n\n${content.trim()}`,
      })

      const skillSlug = mapping.skill.replace(/[^a-z0-9-]/g, '-')
      const globSlug = mapping.glob
        .replace(/\*\*/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      const skillPath2 = resolve(rulesDir, `skill-${skillSlug}-${globSlug}.mdc`)
      if (!dryRun) await writeFile(skillPath2, mdc, 'utf-8')
      files.push(skillPath2)
    }

    return { files }
  }

  /** Normalized relative path; matches `tools.cursor.agent_skills_mirror_root` in harness.config.json. */
  private agentSkillsMirrorRootRel(): string {
    const raw = this.toolConfig.agent_skills_mirror_root
    if (raw === undefined || raw === null) return DEFAULT_AGENT_SKILLS_MIRROR_ROOT
    const s = raw.trim().replace(/\/+$/, '')
    return s || DEFAULT_AGENT_SKILLS_MIRROR_ROOT
  }

  private async buildMainRule(): Promise<string> {
    const rulesContent = await loadAllRules(harnessRoot())

    const skillsNote = this.options.skipSkillsMirror
      ? 'Skills nativas em `.cursor/skills/` (symlink → `.harness/skills/`).'
      : `Cópias para Agent Skills do Cursor (layout nativo, geradas): \`${this.agentSkillsMirrorRootRel()}/\` — não edite à mão (caminho em \`harness.config.json\` → \`tools.cursor.agent_skills_mirror_root\`).`

    return this.buildMdc({
      description: `Harness principal — ${this.project.project.name}`,
      alwaysApply: true,
      globs: [],
      content: `# Harness — ${this.project.project.name}

**Fonte canônica:** edite skills e hooks em \`.harness/skills/\` e \`.harness/hooks/\`, depois rode \`harness sync\`.

Antes de qualquer task, consulte \`.harness/hooks/pre-task.md\`.
Índice de skills: \`.harness/skills/_index.md\`.
${skillsNote}
Em caso de erro: \`.harness/hooks/on-error.md\`.
Hooks executáveis (prompt): \`.cursor/hooks.json\` (gerado do harness; entradas \`_harness\` são substituídas no sync).
${this.toolConfig.supports_mcp ? 'MCP recomendado: `.cursor/MCP-RECOMMENDED.md` e template `.cursor/mcp.recommended.json` (copie para `mcp.json`).' : ''}

${rulesContent.trim()}`,
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
