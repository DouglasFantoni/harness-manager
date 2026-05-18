import { readFile, writeFile } from 'fs/promises'
import type { FeedbackEntry, FeedbackOutcome } from '../types.js'
import { feedbackPath } from './paths.js'

const ENTRIES_HEADER = '# Entradas'
const OUTCOMES: FeedbackOutcome[] = ['success', 'partial', 'failed']

export function parseFeedbackFile(content: string): FeedbackEntry[] {
  const headerIdx = content.indexOf(ENTRIES_HEADER)
  const body = headerIdx >= 0 ? content.slice(headerIdx + ENTRIES_HEADER.length) : content
  const entries: FeedbackEntry[] = []
  const blocks = body.split(/\n(?=- date:)/).map(b => b.trim()).filter(Boolean)

  for (const block of blocks) {
    const entry = parseFeedbackBlock(block)
    if (entry) entries.push(entry)
  }

  return entries
}

function parseFeedbackBlock(block: string): FeedbackEntry | null {
  const text = block.trim()
  const get = (key: string): string | undefined => {
    const patterns = [
      new RegExp(`^\\s*-\\s*${key}:\\s*(.+)$`, 'm'),
      new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'),
    ]
    for (const re of patterns) {
      const m = text.match(re)
      if (m) return m[1]?.trim()
    }
    return undefined
  }

  const date = get('date')
  const task = get('task')
  const outcome = get('outcome') as FeedbackOutcome | undefined
  const confidenceRaw = get('confidence')

  if (!date || !task || !outcome || confidenceRaw === undefined) return null
  if (!OUTCOMES.includes(outcome)) return null

  const confidence = Number(confidenceRaw)
  if (!Number.isFinite(confidence) || confidence < 1 || confidence > 5) return null

  const skillRaw = get('skill_used')
  const commandRaw = get('command_used')
  const notes = get('notes')

  return {
    date,
    task,
    skill_used: normalizeNullable(skillRaw),
    command_used: normalizeNullable(commandRaw),
    outcome,
    confidence,
    ...(notes ? { notes } : {}),
  }
}

function normalizeNullable(value: string | undefined): string | null {
  if (value === undefined || value === 'null' || value === '') return null
  return value
}

export function formatFeedbackEntry(entry: FeedbackEntry): string {
  const lines = [
    `- date: ${entry.date}`,
    `  task: ${yamlScalar(entry.task)}`,
    `  skill_used: ${entry.skill_used ?? 'null'}`,
    `  command_used: ${entry.command_used ?? 'null'}`,
    `  outcome: ${entry.outcome}`,
    `  confidence: ${entry.confidence}`,
  ]
  if (entry.notes) {
    lines.push(`  notes: ${yamlScalar(entry.notes)}`)
  }
  return lines.join('\n')
}

function yamlScalar(value: string): string {
  if (/[:#\n]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
    return JSON.stringify(value)
  }
  return value
}

export async function readFeedbackEntries(): Promise<FeedbackEntry[]> {
  const content = await readFile(feedbackPath(), 'utf-8')
  return parseFeedbackFile(content)
}

export async function appendFeedbackEntry(entry: FeedbackEntry): Promise<void> {
  let content: string
  try {
    content = await readFile(feedbackPath(), 'utf-8')
  } catch {
    content = defaultFeedbackTemplate()
  }

  if (!content.includes(ENTRIES_HEADER)) {
    content = content.trimEnd() + `\n\n${ENTRIES_HEADER}\n\n`
  }

  const trimmed = content.trimEnd()
  const block = formatFeedbackEntry(entry)
  const next = `${trimmed}\n${block}\n`
  await writeFile(feedbackPath(), next, 'utf-8')
}

function defaultFeedbackTemplate(): string {
  return `# Feedback de Sessões

> Registro estruturado de cada sessão que usou skill ou command.
> Use \`harness feedback add\` para entradas confiáveis.

## Formato de entrada

\`\`\`yaml
- date: YYYY-MM-DD
  task: descrição curta da task executada
  skill_used: nome-da-skill ou null
  command_used: /comando ou null
  outcome: success | partial | failed
  confidence: 1-5
  notes: observações opcionais
\`\`\`

---

${ENTRIES_HEADER}

`
}

export function filterFeedbackEntries(
  entries: FeedbackEntry[],
  opts: {
    skill?: string
    command?: string
    outcome?: FeedbackOutcome
    sinceDays?: number
    today?: Date
  },
): FeedbackEntry[] {
  const today = opts.today ?? new Date()
  const cutoff =
    opts.sinceDays != null
      ? new Date(today.getTime() - opts.sinceDays * 24 * 60 * 60 * 1000)
      : null

  return entries.filter(e => {
    if (opts.skill && e.skill_used !== opts.skill) return false
    if (opts.command && e.command_used !== opts.command) return false
    if (opts.outcome && e.outcome !== opts.outcome) return false
    if (cutoff) {
      const d = new Date(`${e.date}T00:00:00`)
      if (d < cutoff) return false
    }
    return true
  })
}

export function validateFeedbackInput(input: {
  task?: string
  outcome?: string
  confidence?: number
}): void {
  if (!input.task?.trim()) {
    throw new Error('--task é obrigatório')
  }
  if (!input.outcome || !OUTCOMES.includes(input.outcome as FeedbackOutcome)) {
    throw new Error(`--outcome deve ser um de: ${OUTCOMES.join(', ')}`)
  }
  if (
    input.confidence === undefined ||
    !Number.isInteger(input.confidence) ||
    input.confidence < 1 ||
    input.confidence > 5
  ) {
    throw new Error('--confidence deve ser um inteiro entre 1 e 5')
  }
}
