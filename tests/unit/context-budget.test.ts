import { mkdir, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { analyzeContextBudget, formatContextBudgetReport } from '../../src/context-budget.js'

const TMP = resolve(tmpdir(), `harness-budget-test-${Date.now()}`)

const config = {
  version: '1.0.0',
  tools: {
    cursor: {
      enabled: true,
      slash_commands: true,
      supports_mcp: true,
      context_budget: 'medium' as const,
      context_tokens_est: 1000,
    },
    copilot: { enabled: false, slash_commands: false, supports_mcp: false, context_budget: 'small' as const, context_tokens_est: 3000 },
  },
  context_strategy: {
    always_load: ['core/rules.md', 'core/glossary.md'],
    load_on_demand: ['skills/'],
    never_load: ['evolution/'],
  },
}

const hooksIndex = {
  hooks: [
    { name: 'pre-task', file: 'pre-task.md', triggers: '', blocks: true, weight: 300, always_load: true },
    { name: 'on-error', file: 'on-error.md', triggers: '', blocks: true, weight: 250, always_load: true },
    { name: 'post-task', file: 'post-task.md', triggers: '', blocks: false, weight: 200, always_load: false },
  ],
}

beforeEach(async () => {
  const harness = resolve(TMP, '.harness')
  await mkdir(resolve(harness, 'core'), { recursive: true })
  await mkdir(resolve(harness, 'hooks'), { recursive: true })
  await mkdir(resolve(harness, 'commands'), { recursive: true })
  await mkdir(resolve(harness, 'skills'), { recursive: true })
  await writeFile(resolve(harness, 'core/rules.md'), 'x'.repeat(500))
  await writeFile(resolve(harness, 'core/glossary.md'), 'y'.repeat(100))
  await writeFile(resolve(harness, 'hooks/pre-task.md'), 'a'.repeat(2000))
  await writeFile(resolve(harness, 'hooks/on-error.md'), 'b'.repeat(2000))
  await writeFile(resolve(harness, 'hooks/post-task.md'), 'c'.repeat(1000))
  await writeFile(resolve(harness, 'hooks/index.json'), JSON.stringify(hooksIndex))
  await writeFile(resolve(harness, 'commands/index.json'), JSON.stringify({ commands: [] }))
  await writeFile(resolve(harness, 'skills/index.json'), JSON.stringify({ skills: [] }))

  vi.spyOn(process, 'cwd').mockReturnValue(TMP)
})

afterEach(async () => {
  vi.restoreAllMocks()
})

describe('analyzeContextBudget', () => {
  it('flags hooks over 20% of enabled tool budget', async () => {
    const report = await analyzeContextBudget(config)
    // hooks total ~700 chars → hundreds of tokens; limit for cursor = 200 (20% of 1000)
    expect(report.hooksTotal).toBeGreaterThan(0)
    expect(report.tools[0].name).toBe('cursor')
    expect(report.tools[0].hookBudgetLimit).toBe(200)
    expect(report.anyOverBudget).toBe(true)
  })

  it('formatContextBudgetReport includes warning when over budget', () => {
    const text = formatContextBudgetReport({
      alwaysLoad: [{ path: 'core/rules.md', tokens: 100 }],
      alwaysLoadTotal: 100,
      hooks: [{ name: 'pre-task', path: 'hooks/pre-task.md', tokens: 250, alwaysLoad: true }],
      hooksTotal: 250,
      tools: [{
        name: 'cursor',
        contextTokensEst: 1000,
        hookBudgetLimit: 200,
        hooksTokens: 250,
        hooksPct: 125,
        overBudget: true,
      }],
      anyOverBudget: true,
    })
    expect(text).toContain('⚠️')
    expect(text).toContain('cursor')
  })
})
