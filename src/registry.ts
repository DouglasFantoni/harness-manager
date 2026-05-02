import { readFile } from 'fs/promises'
import { resolve } from 'path'
import matter from 'gray-matter'
import type { Registry, CommandMeta, SkillMeta } from './types.js'

const HARNESS_ROOT = () => resolve(process.cwd(), '.harness')

export async function loadRegistry(): Promise<Registry> {
  const [commands, skills] = await Promise.all([
    loadCommands(),
    loadSkills(),
  ])
  return { commands, skills }
}

async function loadCommands(): Promise<CommandMeta[]> {
  const indexRaw = await readFile(
    resolve(HARNESS_ROOT(), 'commands/_index.md'), 'utf-8'
  ).catch(() => '')

  if (!indexRaw) return []

  // Tabela: | Comando | Descrição | Cursor | Claude Code | Copilot | Arquivo |
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
      const raw = await readFile(resolve(HARNESS_ROOT(), 'commands', file), 'utf-8')
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
    resolve(HARNESS_ROOT(), 'skills/_index.md'), 'utf-8'
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

    skills.push({
      name, domain, weight,
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
