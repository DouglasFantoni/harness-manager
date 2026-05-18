import { backupMemoryFiles } from '../memory/backup.js'
import { analyzeMemoryStatus, formatMemoryStatus, MEMORY_FILES } from '../memory/status.js'
import { renderPrompt } from './prompt-render.js'

function parseFlag(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) return args[i].split('=').slice(1).join('=')
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1]
  }
  return undefined
}

function parseNumberFlag(args: string[], flag: string, fallback: number): number {
  const raw = parseFlag(args, flag)
  if (raw === undefined) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function runMemory(args: string[]): Promise<void> {
  const sub = args[0]

  if (!sub || sub === '--help' || sub === '-h') {
    printUsage()
    return
  }

  if (sub === 'status') {
    await runMemoryStatus(args.slice(1))
    return
  }

  if (sub === 'summarize') {
    await runMemorySummarize(args.slice(1))
    return
  }

  console.error(`❌ Subcomando desconhecido: "${sub}"`)
  printUsage()
  process.exit(1)
}

async function runMemoryStatus(args: string[]): Promise<void> {
  const perFile = parseNumberFlag(args, '--per-file', 1200)
  const total = parseNumberFlag(args, '--total', 3000)
  const report = await analyzeMemoryStatus(perFile, total)
  console.log(formatMemoryStatus(report))
}

async function runMemorySummarize(args: string[]): Promise<void> {
  const force = args.includes('--force')
  const backup = args.includes('--backup')
  const perFile = parseNumberFlag(args, '--per-file', 1200)
  const total = parseNumberFlag(args, '--total', 3000)

  const report = await analyzeMemoryStatus(perFile, total)
  console.log(formatMemoryStatus(report))
  console.log()

  if (!report.needsSummarize && !force) {
    console.log('ℹ️  Memory is within threshold. Use --force to print the summarize prompt anyway.')
    return
  }

  if (backup) {
    const paths = [...MEMORY_FILES]
    const created = await backupMemoryFiles(paths)
    console.log('💾 Backups created:')
    created.forEach(p => console.log(`   ${p}`))
    console.log()
  }

  const resolved = await renderPrompt('memory-summarize')
  const border = '─'.repeat(60)
  console.log(`${border}`)
  console.log('📋  Prompt: memory-summarize')
  console.log(`${border}\n`)
  console.log(resolved)
  console.log(`\n${border}`)
  console.log('💡  Copy the prompt above into your AI, review the output, then replace the memory files.')
  console.log('   After applying: harness sync')
  if (!backup) {
    console.log('   Tip: re-run with --backup to create .bak.md files before editing.')
  }
  console.log(`${border}\n`)
}

function printUsage(): void {
  console.log(`
  harness memory status [--per-file=1200] [--total=3000]
      Show token counts for memory/*.md files.

  harness memory summarize [--per-file=1200] [--total=3000] [--force] [--backup]
      If memory exceeds thresholds (or --force), prints the AI summarize prompt.
      --backup  copies mistakes/patterns/decisions to *.bak.md before you edit.
`)
}
