import { todayIso } from '../evolution/config.js'
import {
    appendFeedbackEntry,
    filterFeedbackEntries,
    readFeedbackEntries,
    validateFeedbackInput,
} from '../evolution/feedback.js'
import type { FeedbackEntry, FeedbackOutcome } from '../types.js'

function parseFlag(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) return args[i].split('=').slice(1).join('=')
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1]
  }
  return undefined
}

function parseNumberFlag(args: string[], flag: string): number | undefined {
  const raw = parseFlag(args, flag)
  if (raw === undefined) return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

export async function runFeedback(args: string[]): Promise<void> {
  const sub = args[0]

  if (!sub || sub === '--help' || sub === '-h') {
    printUsage()
    return
  }

  if (sub === 'add') {
    await runFeedbackAdd(args.slice(1))
    return
  }

  if (sub === 'list') {
    await runFeedbackList(args.slice(1))
    return
  }

  console.error(`❌ Subcomando desconhecido: "${sub}"`)
  printUsage()
  process.exit(1)
}

async function runFeedbackAdd(args: string[]): Promise<void> {
  const task = parseFlag(args, '--task')
  const outcome = parseFlag(args, '--outcome') as FeedbackOutcome | undefined
  const confidence = parseNumberFlag(args, '--confidence')
  const skill = parseFlag(args, '--skill')
  const command = parseFlag(args, '--command')
  const notes = parseFlag(args, '--notes')
  const date = parseFlag(args, '--date') ?? todayIso()

  validateFeedbackInput({ task, outcome, confidence })

  const entry: FeedbackEntry = {
    date,
    task: task!.trim(),
    skill_used: skill?.trim() || null,
    command_used: command?.trim() || null,
    outcome: outcome!,
    confidence: confidence!,
    ...(notes ? { notes: notes.trim() } : {}),
  }

  await appendFeedbackEntry(entry)
  console.log(`✅ Feedback registrado (${entry.date}) — ${entry.task}`)
}

async function runFeedbackList(args: string[]): Promise<void> {
  const json = args.includes('--json')
  const skill = parseFlag(args, '--skill')
  const command = parseFlag(args, '--command')
  const outcome = parseFlag(args, '--outcome') as FeedbackOutcome | undefined
  const sinceDays = parseNumberFlag(args, '--since')

  const all = await readFeedbackEntries()
  const entries = filterFeedbackEntries(all, {
    skill,
    command,
    outcome,
    sinceDays,
  })

  if (json) {
    console.log(JSON.stringify(entries, null, 2))
    return
  }

  if (entries.length === 0) {
    console.log('ℹ️  Nenhuma entrada de feedback encontrada.')
    return
  }

  console.log(`📋 Feedback (${entries.length} entradas)\n`)
  for (const e of entries) {
    const parts = [
      e.date,
      e.outcome,
      `conf:${e.confidence}`,
      e.skill_used ? `skill:${e.skill_used}` : null,
      e.command_used ? `cmd:${e.command_used}` : null,
    ].filter(Boolean)
    console.log(`  • [${parts.join(' | ')}] ${e.task}`)
    if (e.notes) console.log(`    ${e.notes}`)
  }
}

function printUsage(): void {
  console.log(`
  harness feedback — session log for evolution loop

    harness feedback add --task "..." --outcome success --confidence 4
      --skill <name>       optional
      --command </name>    optional
      --notes "..."        optional
      --date YYYY-MM-DD    optional (default: today)

    harness feedback list [--json] [--skill X] [--command /x] [--outcome failed] [--since 7]
`)
}
