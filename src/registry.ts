import { readFile } from 'fs/promises'
import { resolve } from 'path'
import matter from 'gray-matter'
import type { Registry, CommandMeta, SkillMeta, SkillGlobMapping } from './types.js'

function harnessRoot() { return resolve(process.cwd(), '.harness') }

export async function loadRegistry(): Promise<Registry> {
  const [commands, skills] = await Promise.all([
    loadCommands(),
    loadSkills(),
  ])

  // Deriva mapeamentos glob → skill a partir das skills que declaram globs
  const skillGlobs: SkillGlobMapping[] = skills
    .filter(s => s.globs?.length)
    .flatMap(s => (s.globs ?? []).map(glob => ({
      glob,
      skill: s.name,
      description: `Carrega skill "${s.name}" (${s.domain})`,
    })))

  return { commands, skills, skillGlobs }
}

async function loadCommands(): Promise<CommandMeta[]> {
  const indexRaw = await readFile(
    resolve(harnessRoot(), 'commands/_index.md'), 'utf-8'
  ).catch(() => '')

  if (!indexRaw) return []

  const rows = parseTable(indexRaw)
  const commands: CommandMeta[] = []

  for (const cols of rows) {
    if (cols.length < 6) continue

    const name    = stripBackticks(cols[0])
    const desc    = cols[1]
    const cursor  = cols[2].includes('✅')
    const claude  = cols[3].includes('✅')
    const copilot = cols[4].includes('✅')
    const file    = stripBackticks(cols[5])

    if (!name.startsWith('/')) continue

    const supported_by_table: string[] = [
      cursor  && 'cursor',
      claude  && 'claude-code',
      copilot && 'copilot',
    ].filter(Boolean) as string[]

    let supported_by = supported_by_table
    let description  = desc
    let globs: string[] = []
    let requires: string[] = []

    try {
      const raw = await readFile(resolve(harnessRoot(), 'commands', file), 'utf-8')
      const { data } = matter(raw)
      if (data.supported_by?.length) supported_by = data.supported_by
      if (data.description)          description  = data.description
      if (data.globs?.length)        globs        = data.globs
      if (data.requires?.length)     requires     = data.requires
    } catch {}

    commands.push({ name, file, description, supported_by, requires, globs })
  }

  return commands
}

async function loadSkills(): Promise<SkillMeta[]> {
  const indexRaw = await readFile(
    resolve(harnessRoot(), 'skills/_index.md'), 'utf-8'
  ).catch(() => '')

  if (!indexRaw) return []

  const rows = parseTable(indexRaw)
  const skills: SkillMeta[] = []

  for (const cols of rows) {
    if (cols.length < 2) continue

    const name   = stripBackticks(cols[0])
    const domain = cols[1]?.trim() ?? ''
    const weight = parseInt(cols[2]?.replace(/[^0-9]/g, '') ?? '0') || 0

    if (!name) continue

    // Lê globs do SKILL.md se existir
    let globs: string[] = []
    try {
      const skillPath = resolve(harnessRoot(), `skills/${name}/SKILL.md`)
      const raw = await readFile(skillPath, 'utf-8')

      // Extrai bloco yaml do ## Meta
      const metaMatch = raw.match(/```yaml\n([\s\S]*?)```/)
      if (metaMatch) {
        const metaLines = metaMatch[1].split('\n')
        const globLine = metaLines.find(l => l.trim().startsWith('globs:'))
        if (globLine) {
          // globs: ["**/*.service.ts", "**/*.controller.ts"]
          const globMatch = globLine.match(/\[([^\]]+)\]/)
          if (globMatch) {
            globs = globMatch[1]
              .split(',')
              .map(g => g.trim().replace(/['"]/g, ''))
              .filter(Boolean)
          }
        }
      }
    } catch {}

    skills.push({
      name, domain, weight, globs,
      exposes_command: [],
      required_by: [],
      load_with: [],
      conflicts_with: [],
    })
  }

  return skills
}

function parseTable(markdown: string): string[][] {
  return markdown
    .split('\n')
    .filter(line => {
      const t = line.trim()
      return t.startsWith('|') && !t.includes('---')
    })
    .map(line =>
      line.split('|').slice(1, -1).map(c => c.trim())
    )
    .filter(cols => {
      const first = cols[0]?.toLowerCase() ?? ''
      return !['comando', 'skill', 'hook', 'command'].includes(first)
    })
}

function stripBackticks(value: string): string {
  return value.replace(/`/g, '').trim()
}
