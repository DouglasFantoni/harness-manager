import { readFile } from 'fs/promises'
import { resolve } from 'path'
import matter from 'gray-matter'
import type { Registry, CommandMeta, SkillMeta } from './types.js'

const HARNESS_ROOT = resolve(process.cwd(), '.harness')

export async function loadRegistry(): Promise<Registry> {
  const [commands, skills] = await Promise.all([
    loadCommands(),
    loadSkills(),
  ])
  return { commands, skills }
}

async function loadCommands(): Promise<CommandMeta[]> {
  const indexRaw = await readFile(
    resolve(HARNESS_ROOT, 'commands/_index.md'), 'utf-8'
  ).catch(() => '')

  const commands: CommandMeta[] = []

  // Parseia a tabela markdown do _index.md
  const rows = indexRaw
    .split('\n')
    .filter(line => line.startsWith('|') && !line.includes('---') && !line.includes('Comando'))

  for (const row of rows) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 5) continue

    const name = cols[0].replace('`', '').replace('`', '')  // remove backticks
    const file = cols[4]  // coluna "Arquivo"

    // Lê o frontmatter do arquivo do command para pegar supported_by
    const cmdPath = resolve(HARNESS_ROOT, 'commands', file)
    let supported_by: string[] = []
    let description = cols[1]
    let globs: string[] = []

    try {
      const raw = await readFile(cmdPath, 'utf-8')
      const { data } = matter(raw)
      supported_by = data.supported_by ?? []
      description = data.description ?? description
      globs = data.globs ?? []
    } catch {
      // arquivo não encontrado — usa defaults da tabela
      const cursorOk = cols[2] === '✅'
      const claudeOk = cols[3] === '✅'
      if (cursorOk) supported_by.push('cursor')
      if (claudeOk) supported_by.push('claude-code')
    }

    commands.push({
      name,
      file: file.replace('`', '').replace('`', ''),
      description,
      supported_by,
      requires: [],
      globs,
    })
  }

  return commands
}

async function loadSkills(): Promise<SkillMeta[]> {
  const indexRaw = await readFile(
    resolve(HARNESS_ROOT, 'skills/_index.md'), 'utf-8'
  ).catch(() => '')

  const skills: SkillMeta[] = []

  const rows = indexRaw
    .split('\n')
    .filter(line => line.startsWith('|') && !line.includes('---') && !line.includes('Skill'))

  for (const row of rows) {
    const cols = row.split('|').map(c => c.trim()).filter(Boolean)
    if (cols.length < 2) continue

    const name = cols[0]
    const domain = cols[1]
    const weightRaw = cols[2] ?? '~0'
    const weight = parseInt(weightRaw.replace(/[^0-9]/g, '') || '0')

    skills.push({
      name,
      domain,
      weight,
      exposes_command: [],
      required_by: [],
      load_with: [],
      conflicts_with: [],
    })
  }

  return skills
}
