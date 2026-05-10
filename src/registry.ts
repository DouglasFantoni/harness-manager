import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type { Registry, CommandMeta, SkillMeta, HookMeta, SkillGlobMapping } from './types.js'

function harnessRoot() { return resolve(process.cwd(), '.harness') }

export async function loadRegistry(): Promise<Registry> {
  const [commands, skills, hooks] = await Promise.all([
    loadCommands(),
    loadSkills(),
    loadHooks(),
  ])

  const skillGlobs: SkillGlobMapping[] = skills
    .filter(s => s.globs?.length)
    .flatMap(s => s.globs.map(glob => ({
      glob,
      skill: s.name,
      description: s.description
        ? `Carrega skill "${s.name}" — ${s.description}`
        : `Carrega skill "${s.name}" (${s.domain})`,
    })))

  return { commands, skills, hooks, skillGlobs }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function loadCommands(): Promise<CommandMeta[]> {
  // 1. Tenta JSON (nova fonte de verdade)
  const jsonPath = resolve(harnessRoot(), 'commands/index.json')
  try {
    const raw = await readFile(jsonPath, 'utf-8')
    const { commands } = JSON.parse(raw) as { commands: CommandMeta[] }
    return commands
  } catch {}

  // 2. Fallback: parseia _index.md legado
  return parseCommandsMarkdown()
}

async function parseCommandsMarkdown(): Promise<CommandMeta[]> {
  const raw = await readFile(
    resolve(harnessRoot(), 'commands/_index.md'), 'utf-8'
  ).catch(() => '')

  if (!raw) return []

  const rows = parseTable(raw)
  const commands: CommandMeta[] = []

  for (const cols of rows) {
    if (cols.length < 6) continue
    const name   = stripBackticks(cols[0])
    const cursor  = cols[2].includes('✅')
    const claude  = cols[3].includes('✅')
    const copilot = cols[4].includes('✅')
    const file    = stripBackticks(cols[5])

    if (!name.startsWith('/')) continue

    commands.push({
      name,
      file,
      description: cols[1],
      supported_by: [
        cursor  && 'cursor',
        claude  && 'claude-code',
        copilot && 'copilot',
      ].filter(Boolean) as string[],
      requires: [],
      globs: [],
    })
  }

  return commands
}

// ─── Skills ───────────────────────────────────────────────────────────────────

async function loadSkills(): Promise<SkillMeta[]> {
  // 1. Tenta JSON
  const jsonPath = resolve(harnessRoot(), 'skills/index.json')
  try {
    const raw = await readFile(jsonPath, 'utf-8')
    const { skills } = JSON.parse(raw) as { skills: SkillMeta[] }
    return skills
  } catch {}

  // 2. Fallback: parseia _index.md legado
  return parseSkillsMarkdown()
}

async function parseSkillsMarkdown(): Promise<SkillMeta[]> {
  const raw = await readFile(
    resolve(harnessRoot(), 'skills/_index.md'), 'utf-8'
  ).catch(() => '')

  if (!raw) return []

  const rows = parseTable(raw)
  return rows
    .filter(cols => cols.length >= 2)
    .map(cols => ({
      name: stripBackticks(cols[0]),
      domain: cols[1]?.trim() ?? '',
      weight: parseInt(cols[2]?.replace(/[^0-9]/g, '') ?? '0') || 0,
      description: undefined,
      exposes_command: [],
      required_by: [],
      load_with: [],
      conflicts_with: [],
      globs: [],
      source: null,
      sync: false,
    }))
    .filter(s => s.name)
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

async function loadHooks(): Promise<HookMeta[]> {
  // 1. Tenta JSON
  const jsonPath = resolve(harnessRoot(), 'hooks/index.json')
  try {
    const raw = await readFile(jsonPath, 'utf-8')
    const { hooks } = JSON.parse(raw) as { hooks: HookMeta[] }
    return hooks
  } catch {}

  // 2. Fallback: parseia _index.md legado
  return parseHooksMarkdown()
}

async function parseHooksMarkdown(): Promise<HookMeta[]> {
  const raw = await readFile(
    resolve(harnessRoot(), 'hooks/_index.md'), 'utf-8'
  ).catch(() => '')

  if (!raw) return []

  const rows = parseTable(raw)
  return rows
    .filter(cols => cols.length >= 4)
    .map(cols => ({
      name: stripBackticks(cols[0]),
      file: `${stripBackticks(cols[0])}.md`,
      triggers: cols[1]?.trim() ?? '',
      blocks: cols[2]?.includes('✅') ?? false,
      weight: parseInt(cols[3]?.replace(/[^0-9]/g, '') ?? '0') || 0,
      always_load: false,
    }))
    .filter(h => h.name)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTable(markdown: string): string[][] {
  return markdown
    .split('\n')
    .filter(line => {
      const t = line.trim()
      return t.startsWith('|') && !t.includes('---')
    })
    .map(line => line.split('|').slice(1, -1).map(c => c.trim()))
    .filter(cols => {
      const first = cols[0]?.toLowerCase() ?? ''
      return !['comando', 'skill', 'hook', 'command', 'hook'].includes(first)
    })
}

function stripBackticks(value: string): string {
  return value.replace(/`/g, '').trim()
}
