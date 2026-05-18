import { mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeMemoryStatus, formatMemoryStatus } from '../../src/memory/status.js'

const TMP = resolve(tmpdir(), `harness-memory-test-${Date.now()}`)

beforeEach(async () => {
  const harness = resolve(TMP, '.harness', 'memory')
  await mkdir(harness, { recursive: true })
  await writeFile(resolve(harness, 'mistakes.md'), '# Mistakes\n' + 'line\n'.repeat(50))
  await writeFile(resolve(harness, 'patterns.md'), '# Patterns\nshort')
  await writeFile(resolve(harness, 'decisions.md'), '# Decisions\n' + 'adr\n'.repeat(200))

  vi.spyOn(process, 'cwd').mockReturnValue(TMP)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('analyzeMemoryStatus', () => {
  it('detects when total exceeds threshold', async () => {
    const report = await analyzeMemoryStatus(10, 50)
    expect(report.totalTokens).toBeGreaterThan(50)
    expect(report.needsSummarize).toBe(true)
    expect(report.files).toHaveLength(3)
  })

  it('reports within budget for high thresholds', async () => {
    const report = await analyzeMemoryStatus(100_000, 100_000)
    expect(report.needsSummarize).toBe(false)
  })
})

describe('formatMemoryStatus', () => {
  it('suggests summarize when over threshold', () => {
    const text = formatMemoryStatus({
      files: [
        { path: 'memory/mistakes.md', tokens: 1500, overPerFileThreshold: true },
        { path: 'memory/patterns.md', tokens: 100, overPerFileThreshold: false },
        { path: 'memory/decisions.md', tokens: 100, overPerFileThreshold: false },
      ],
      totalTokens: 1700,
      overTotalThreshold: false,
      perFileThreshold: 1200,
      totalThreshold: 3000,
      needsSummarize: true,
    })
    expect(text).toContain('harness memory summarize')
    expect(text).toContain('⚠️')
  })
})
