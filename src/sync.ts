import { relative } from 'path'
import { loadConfig } from './config.js'
import { generateSkillMinFiles } from './skill-minifier.js'
import { generateContext } from './context-gen.js'
import { loadRegistry } from './registry.js'
import { resetWarnings } from './resolver.js'
import { ClaudeCodeAdapter } from './adapters/claude-code.js'
import { CursorAdapter } from './adapters/cursor.js'
import { CopilotAdapter } from './adapters/copilot.js'
import type { SyncFlags } from './types.js'

const ADAPTERS = {
  'claude-code': ClaudeCodeAdapter,
  cursor: CursorAdapter,
  copilot: CopilotAdapter,
} as const

type ToolName = keyof typeof ADAPTERS

export async function runSync(flags: SyncFlags): Promise<void> {
  console.log('🔄 harness sync\n')
  resetWarnings()

  if (flags.dryRun) {
    console.log('ℹ️  Modo --dry-run: nenhum arquivo será escrito\n')
  }

  const { config, project } = await loadConfig()

  if (!flags.dryRun) {
    const updated = await generateContext(project, flags.forceContext)
    if (updated) console.log('📄 core/context.md atualizado\n')
  }

  // Gera SKILL.min.md e reporta métricas de tokens
  if (!flags.dryRun) {
    const minResults = await generateSkillMinFiles()
    const changed = minResults.filter(r => r.changed)
    if (changed.length > 0) {
      const totalBefore = changed.reduce((s, r) => s + r.tokensBefore, 0)
      const totalAfter  = changed.reduce((s, r) => s + r.tokensAfter, 0)
      const pct = Math.round((1 - totalAfter / totalBefore) * 100)
      console.log(`⚡ ${changed.length} skill(s) minificada(s) — ${totalBefore} → ${totalAfter} tokens (-${pct}%)\n`)
    }
  }

  const registry = await loadRegistry()

  const toolEntries = Object.entries(config.tools).filter(([name, tool]) => {
    if (!tool.enabled) return false
    if (flags.only && name !== flags.only) return false
    return true
  })

  const skipped = Object.entries(config.tools).filter(([, t]) => !t.enabled)

  for (const [toolName, toolConfig] of toolEntries) {
    const AdapterClass = ADAPTERS[toolName as ToolName]

    if (!AdapterClass) {
      console.warn(`⚠️  Adapter não implementado para: ${toolName}`)
      continue
    }

    const adapter = new AdapterClass(toolConfig, project, registry)
    const result = await adapter.generate(flags.dryRun)

    const icon = flags.dryRun ? '🔍' : '✅'
    console.log(`${icon} ${toolName}:`)
    // B10 — usa path.relative() ao invés de string replace com separador hardcoded
    result.files.forEach(f => console.log(`   → ${relative(process.cwd(), f)}`))
    console.log()
  }

  for (const [toolName] of skipped) {
    if (!flags.only) {
      console.log(`⏭️  ${toolName}: desabilitado em harness.config.json`)
    }
  }

  console.log('\n✨ harness sync concluído')
}
