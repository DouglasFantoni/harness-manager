import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { countTokens } from '../skill-minifier.js'

export const MEMORY_FILES = ['memory/mistakes.md', 'memory/patterns.md', 'memory/decisions.md'] as const

export type MemoryFilePath = (typeof MEMORY_FILES)[number]

export interface MemoryFileStatus {
  path: MemoryFilePath
  tokens: number
  overPerFileThreshold: boolean
}

export interface MemoryStatusReport {
  files: MemoryFileStatus[]
  totalTokens: number
  overTotalThreshold: boolean
  perFileThreshold: number
  totalThreshold: number
  needsSummarize: boolean
}

function harnessRoot() {
  return resolve(process.cwd(), '.harness')
}

export async function analyzeMemoryStatus(
  perFileThreshold = 1200,
  totalThreshold = 3000,
): Promise<MemoryStatusReport> {
  const files: MemoryFileStatus[] = []

  for (const path of MEMORY_FILES) {
    const content = await readFile(resolve(harnessRoot(), path), 'utf-8').catch(() => '')
    const tokens = await countTokens(content)
    files.push({
      path,
      tokens,
      overPerFileThreshold: tokens > perFileThreshold,
    })
  }

  const totalTokens = files.reduce((s, f) => s + f.tokens, 0)
  const overTotalThreshold = totalTokens > totalThreshold
  const needsSummarize = files.some(f => f.overPerFileThreshold) || overTotalThreshold

  return {
    files,
    totalTokens,
    overTotalThreshold,
    perFileThreshold,
    totalThreshold,
    needsSummarize,
  }
}

export function formatMemoryStatus(report: MemoryStatusReport): string {
  const lines: string[] = ['📚 Memory token usage (gpt-4 encoding)\n']

  for (const f of report.files) {
    const flag = f.overPerFileThreshold ? ' ⚠️' : ''
    const name = f.path.replace('memory/', '')
    lines.push(`  ${name.padEnd(16)} ${f.tokens.toLocaleString().padStart(8)} tokens${flag}`)
  }

  lines.push(`  ${'─'.repeat(32)}`)
  lines.push(`  ${'total'.padEnd(16)} ${report.totalTokens.toLocaleString().padStart(8)} tokens${report.overTotalThreshold ? ' ⚠️' : ''}`)
  lines.push('')
  lines.push(`  Threshold: ${report.perFileThreshold.toLocaleString()}/file, ${report.totalThreshold.toLocaleString()} total`)

  if (report.needsSummarize) {
    lines.push('\n  ⚠️  Memory exceeds threshold — run: harness memory summarize')
  } else {
    lines.push('\n  ✅ Memory within budget')
  }

  return lines.join('\n')
}
