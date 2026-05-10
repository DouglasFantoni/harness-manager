import { readFile, writeFile, readdir, access } from 'fs/promises'
import { resolve } from 'path'
import type { SkillMeta, CommandMeta, HookMeta } from './types.js'

function harnessRoot() { return resolve(process.cwd(), '.harness') }

export interface AutoRegisterResult {
  skills: SkillMeta[]
  rules: string[]    // packs que receberam meta injetado
  hooks: HookMeta[]
}

/**
 * Detecta itens locais não catalogados e atualiza os JSONs.
 * Chamado pelo sync antes de gerar os adapters.
 *
 * Nunca sobrescreve entradas existentes — apenas adiciona novas.
 * Itens locais sempre recebem sync: false e source: null.
 */
export async function autoRegister(
  currentSkills: SkillMeta[],
  currentCommands: CommandMeta[],
  currentHooks: HookMeta[],
  dryRun = false,
): Promise<AutoRegisterResult> {
  const [newSkills, newRules, newHooks] = await Promise.all([
    discoverSkills(currentSkills, dryRun),
    discoverRules(dryRun),
    discoverHooks(currentHooks, dryRun),
  ])

  return { skills: newSkills, rules: newRules, hooks: newHooks }
}

// ─── Skills ───────────────────────────────────────────────────────────────────

async function discoverSkills(current: SkillMeta[], dryRun: boolean): Promise<SkillMeta[]> {
  const skillsDir = resolve(harnessRoot(), 'skills')
  const knownNames = new Set(current.map(s => s.name))
  const newSkills: SkillMeta[] = []

  let entries: string[] = []
  try {
    const dirs = await readdir(skillsDir, { withFileTypes: true })
    entries = dirs
      .filter(d => d.isDirectory() && !d.name.startsWith('_'))
      .map(d => d.name)
  } catch {
    return []
  }

  for (const name of entries) {
    if (knownNames.has(name)) continue

    const skillPath = resolve(skillsDir, name, 'SKILL.md')
    if (!(await fileExists(skillPath))) continue

    const raw = await readFile(skillPath, 'utf-8')
    const meta = extractSkillMeta(raw, name)

    // Garante que o SKILL.md tem Meta mínimo — injeta se ausente
    const updated = ensureSkillMeta(raw, meta)
    if (updated !== raw && !dryRun) {
      await writeFile(skillPath, updated, 'utf-8')
    }

    newSkills.push(meta)
  }

  if (newSkills.length > 0 && !dryRun) {
    const jsonPath = resolve(harnessRoot(), 'skills/index.json')
    const existing = await readJsonFile<{ skills: SkillMeta[] }>(jsonPath, { skills: [] })
    existing.skills.push(...newSkills)
    await writeFile(jsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  }

  return newSkills
}

// ─── Rules ────────────────────────────────────────────────────────────────────

async function discoverRules(dryRun: boolean): Promise<string[]> {
  const rulesDir = resolve(harnessRoot(), 'core/rules')
  const injected: string[] = []

  let entries: string[] = []
  try {
    const files = await readdir(rulesDir, { withFileTypes: true })
    entries = files
      .filter(f => f.isFile() && f.name.endsWith('.md') && !f.name.startsWith('_'))
      .map(f => f.name)
  } catch {
    return []
  }

  for (const fileName of entries) {
    const filePath = resolve(rulesDir, fileName)
    const raw = await readFile(filePath, 'utf-8')

    // Verifica se tem Meta com sync declarado
    if (hasMeta(raw)) continue

    // Injeta Meta mínimo — marca como local
    const name = fileName.replace('.md', '')
    const withMeta = injectRuleMeta(raw, name)

    if (!dryRun) await writeFile(filePath, withMeta, 'utf-8')
    injected.push(fileName)
  }

  return injected
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

async function discoverHooks(current: HookMeta[], dryRun: boolean): Promise<HookMeta[]> {
  const hooksDir = resolve(harnessRoot(), 'hooks')
  const knownNames = new Set(current.map(h => h.name))
  const newHooks: HookMeta[] = []

  let entries: string[] = []
  try {
    const files = await readdir(hooksDir, { withFileTypes: true })
    entries = files
      .filter(f => f.isFile() && f.name.endsWith('.md') && !f.name.startsWith('_'))
      .map(f => f.name.replace('.md', ''))
  } catch {
    return []
  }

  for (const name of entries) {
    if (knownNames.has(name)) continue

    const hookPath = resolve(hooksDir, `${name}.md`)
    const raw = await readFile(hookPath, 'utf-8').catch(() => null)
    if (!raw) continue

    const hook: HookMeta = {
      name,
      file: `${name}.md`,
      triggers: inferHookTrigger(name),
      blocks: inferHookBlocks(name),
      weight: inferHookWeight(raw),
      always_load: false,
    }

    newHooks.push(hook)
  }

  if (newHooks.length > 0 && !dryRun) {
    const jsonPath = resolve(harnessRoot(), 'hooks/index.json')
    const existing = await readJsonFile<{ hooks: HookMeta[] }>(jsonPath, { hooks: [] })
    existing.hooks.push(...newHooks)
    await writeFile(jsonPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
  }

  return newHooks
}

// ─── Extração de Meta de Skills ───────────────────────────────────────────────

function extractSkillMeta(content: string, name: string): SkillMeta {
  const defaults: SkillMeta = {
    name,
    domain: '',
    weight: 500,
    description: undefined,
    exposes_command: [],
    required_by: [],
    load_with: [],
    conflicts_with: [],
    globs: [],
    source: null,
    sync: false,
  }

  const metaMatch = content.match(/```yaml\n([\s\S]*?)```/)
  if (!metaMatch) return defaults

  const yaml = metaMatch[1]

  return {
    ...defaults,
    domain:          extractYamlString(yaml, 'domain') ?? '',
    weight:          extractYamlNumber(yaml, 'weight') ?? 500,
    description:     extractYamlString(yaml, 'description') ?? undefined,
    exposes_command: extractYamlArray(yaml, 'exposes_command'),
    required_by:     extractYamlArray(yaml, 'required_by'),
    load_with:       extractYamlArray(yaml, 'load_with'),
    conflicts_with:  extractYamlArray(yaml, 'conflicts_with'),
    globs:           extractYamlArray(yaml, 'globs'),
    source:          null,   // sempre null para skills locais
    sync:            false,  // sempre false — é local
  }
}

/**
 * Garante que o SKILL.md tem os campos obrigatórios no Meta.
 * Injeta sync: false e source: null se ausentes.
 * Adiciona seção CUSTOM se ausente.
 */
function ensureSkillMeta(content: string, meta: SkillMeta): string {
  let result = content

  // Adiciona seção Meta se não existir
  if (!hasMeta(result)) {
    const metaBlock = `## Meta

\`\`\`yaml
domain: "${meta.domain || ''}"
weight: ~${meta.weight}
exposes_command: []
required_by: []
load_with: []
conflicts_with: []
globs: []
sync: false
\`\`\`

`
    // Insere após o título
    result = result.replace(/^(# Skill:.*\n)/, `$1\n${metaBlock}`)
  } else {
    // Meta existe — garante sync: false se ausente
    const metaMatch = result.match(/(```yaml\n)([\s\S]*?)(```)/)
    if (metaMatch && !metaMatch[2].includes('sync:')) {
      result = result.replace(
        /(```yaml\n[\s\S]*?)(```)/,
        `$1sync: false\n$2`
      )
    }
  }

  // Adiciona seção CUSTOM se ausente
  if (!result.includes('HARNESS:CUSTOM:START')) {
    result = result.trimEnd() + '\n\n## Customizações do projeto\n\n<!-- HARNESS:CUSTOM:START -->\n<!-- HARNESS:CUSTOM:END -->\n'
  }

  return result
}

// ─── Injeção de Meta em Rules ─────────────────────────────────────────────────

function injectRuleMeta(content: string, name: string): string {
  const metaBlock = `## Meta

\`\`\`yaml
version: "1.0.0"
category: "${name}"
sync: false
\`\`\`

`
  // Insere após o título
  const withMeta = content.replace(/^(# Rules?:.*\n)/, `$1\n${metaBlock}`)

  // Adiciona seção CUSTOM se ausente
  if (!withMeta.includes('HARNESS:CUSTOM:START')) {
    return withMeta.trimEnd() + '\n\n## Customizações do projeto\n\n<!-- HARNESS:CUSTOM:START -->\n<!-- HARNESS:CUSTOM:END -->\n'
  }

  return withMeta
}

// ─── Inferência de Hook ───────────────────────────────────────────────────────

function inferHookTrigger(name: string): string {
  const triggers: Record<string, string> = {
    'pre-task':      'Início de qualquer task',
    'post-task':     'Conclusão de qualquer task',
    'on-error':      'Qualquer falha ou exceção',
    'on-ambiguity':  'Input incerto ou conflitante',
    'on-skill-load': 'Antes de carregar qualquer skill',
    'on-command':    'Antes de executar slash command',
  }
  return triggers[name] ?? `Ao detectar: ${name.replace(/^on-/, '').replace(/-/g, ' ')}`
}

function inferHookBlocks(name: string): boolean {
  return ['pre-task', 'on-error', 'on-ambiguity', 'on-command'].includes(name)
}

function inferHookWeight(content: string): number {
  // Estima peso pelo tamanho do arquivo (~1.3 tokens por palavra)
  const words = content.split(/\s+/).length
  return Math.round(words * 1.3 / 10) * 10 // arredonda para dezena
}

// ─── Helpers YAML ─────────────────────────────────────────────────────────────

function hasMeta(content: string): boolean {
  return content.includes('```yaml')
}

function extractYamlString(yaml: string, key: string): string | null {
  const match = yaml.match(new RegExp(`${key}:\\s*["']?([^"'\\n\\[\\]]+)["']?`))
  return match?.[1]?.trim() ?? null
}

function extractYamlNumber(yaml: string, key: string): number | null {
  const match = yaml.match(new RegExp(`${key}:\\s*~?(\\d+)`))
  return match ? parseInt(match[1]) : null
}

function extractYamlArray(yaml: string, key: string): string[] {
  const match = yaml.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))
  if (!match || !match[1].trim()) return []
  return match[1]
    .split(',')
    .map(s => s.trim().replace(/['"]/g, ''))
    .filter(Boolean)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}
