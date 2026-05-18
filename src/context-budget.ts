import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { loadRegistry } from './registry.js'
import { countTokens } from './skill-minifier.js'
import type { HarnessConfig, HookMeta } from './types.js'

const HOOK_BUDGET_RATIO = 0.2

function harnessRoot() {
  return resolve(process.cwd(), '.harness')
}

export interface FileTokenUsage {
  path: string
  tokens: number
}

export interface ToolBudgetStatus {
  name: string
  contextTokensEst: number
  hookBudgetLimit: number
  hooksTokens: number
  hooksPct: number
  overBudget: boolean
}

export interface ContextBudgetReport {
  alwaysLoad: FileTokenUsage[]
  alwaysLoadTotal: number
  hooks: Array<FileTokenUsage & { name: string; alwaysLoad: boolean }>
  hooksTotal: number
  tools: ToolBudgetStatus[]
  anyOverBudget: boolean
}

async function readHarnessFileTokens(relativePath: string): Promise<FileTokenUsage> {
  const path = resolve(harnessRoot(), relativePath)
  const content = await readFile(path, 'utf-8').catch(() => '')
  return { path: relativePath, tokens: await countTokens(content) }
}

async function readHookTokens(hook: HookMeta): Promise<FileTokenUsage & { name: string; alwaysLoad: boolean }> {
  const relativePath = `hooks/${hook.file}`
  const usage = await readHarnessFileTokens(relativePath)
  return { ...usage, name: hook.name, alwaysLoad: hook.always_load }
}

/**
 * Measures token usage for always_load paths and all registered hooks,
 * compared to 20% of each enabled tool's context_tokens_est.
 */
export async function analyzeContextBudget(config: HarnessConfig): Promise<ContextBudgetReport> {
  const registry = await loadRegistry()

  const alwaysLoad = await Promise.all(
    config.context_strategy.always_load.map(p => readHarnessFileTokens(p)),
  )
  const alwaysLoadTotal = alwaysLoad.reduce((s, f) => s + f.tokens, 0)

  const hooks = await Promise.all(registry.hooks.map(readHookTokens))
  const hooksTotal = hooks.reduce((s, h) => s + h.tokens, 0)

  const tools: ToolBudgetStatus[] = Object.entries(config.tools)
    .filter(([, t]) => t.enabled)
    .map(([name, tool]) => {
      const hookBudgetLimit = Math.floor(tool.context_tokens_est * HOOK_BUDGET_RATIO)
      const hooksPct = hookBudgetLimit > 0
        ? Math.round((hooksTotal / hookBudgetLimit) * 100)
        : 0
      return {
        name,
        contextTokensEst: tool.context_tokens_est,
        hookBudgetLimit,
        hooksTokens: hooksTotal,
        hooksPct,
        overBudget: hooksTotal > hookBudgetLimit,
      }
    })

  return {
    alwaysLoad,
    alwaysLoadTotal,
    hooks,
    hooksTotal,
    tools,
    anyOverBudget: tools.some(t => t.overBudget),
  }
}

export function formatContextBudgetReport(report: ContextBudgetReport): string {
  const lines: string[] = ['📊 Context budget\n']

  lines.push('always_load:')
  if (report.alwaysLoad.length === 0) {
    lines.push('  (nenhum arquivo configurado)')
  } else {
    for (const f of report.alwaysLoad) {
      lines.push(`  ${f.path.padEnd(28)} ${f.tokens.toLocaleString()} tokens`)
    }
    lines.push(`  ${'total'.padEnd(28)} ${report.alwaysLoadTotal.toLocaleString()} tokens`)
  }

  lines.push('\nhooks (todos registrados):')
  for (const h of report.hooks) {
    const tag = h.alwaysLoad ? 'always' : 'on-demand'
    lines.push(`  ${h.name.padEnd(16)} ${String(h.tokens).padStart(6)} tokens  (${tag})`)
  }
  lines.push(`  ${'total'.padEnd(16)} ${String(report.hooksTotal).padStart(6)} tokens`)

  lines.push('\nlimite de hooks (20% do context budget por tool ativa):')
  for (const t of report.tools) {
    const icon = t.overBudget ? '⚠️ ' : '✅ '
    lines.push(
      `  ${icon}${t.name}: ${t.hooksTokens} / ${t.hookBudgetLimit} tokens (${t.hooksPct}% de ${t.contextTokensEst})`,
    )
  }

  if (report.anyOverBudget) {
    lines.push(
      '\n⚠️  Hooks excedem 20% do budget em uma ou mais tools — considere enxugar hooks ou aumentar context_tokens_est.',
    )
  }

  return lines.join('\n')
}

export async function printContextBudgetWarnings(config: HarnessConfig): Promise<void> {
  const report = await analyzeContextBudget(config)
  console.log(formatContextBudgetReport(report))
  if (report.anyOverBudget) console.log()
}
