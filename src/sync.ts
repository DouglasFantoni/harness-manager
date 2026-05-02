import { loadConfig } from './config.js'
import { generateContext } from './context-gen.js'
import { loadRegistry } from './registry.js'
import { ClaudeCodeAdapter } from './adapters/claude-code.js'
import { CursorAdapter } from './adapters/cursor.js'
import { resolvePlaceholders, resetWarnings } from './resolver.js'
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

  // 1. Carrega configs
  const { config, project } = await loadConfig()

  // 2. Gera/atualiza core/context.md
  if (!flags.dryRun) {
    const updated = await generateContext(project, flags.forceContext)
    if (updated) {
      console.log('📄 core/context.md atualizado\n')
    }
  }

  // 3. Carrega registry de skills e commands
  const registry = await loadRegistry()

  // 4. Para cada tool ativa, gera o adapter
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
    result.files.forEach(f => {
      const relative = f.replace(process.cwd() + '/', '')
      console.log(`   → ${relative}`)
    })
    console.log()
  }

  for (const [toolName] of skipped) {
    if (!flags.only) {
      console.log(`⏭️  ${toolName}: desabilitado em harness.config.json`)
    }
  }

  console.log('\n✨ harness sync concluído')
}
