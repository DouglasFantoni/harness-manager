import { relative } from 'path'
import { ClaudeCodeAdapter } from './adapters/claude-code.js'
import { CopilotAdapter } from './adapters/copilot.js'
import { CursorAdapter } from './adapters/cursor.js'
import { autoRegister } from './auto-register.js'
import { loadConfig } from './config.js'
import { printContextBudgetWarnings } from './context-budget.js'
import { generateContext } from './context-gen.js'
import { generateIndexFiles } from './index-generator.js'
import { loadRegistry } from './registry.js'
import { resetWarnings } from './resolver.js'
import { generateSkillMinFiles } from './skill-minifier.js'
import { linkSkills } from './skills-link.js'
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

  // Skills link — symlink (Linux/Mac/WSL) ou copy (Windows nativo)
  if (config.skills) {
    const linkResults = await linkSkills({
      projectRoot: process.cwd(),
      source: config.skills.source,
      targets: config.skills.targets,
      dryRun: flags.dryRun,
    })

    const icon = flags.dryRun ? '🔍' : '🔗'
    const strategyLabel = linkResults[0]?.strategy ?? 'symlink'
    console.log(`${icon} skills (${strategyLabel}):`)
    for (const r of linkResults) {
      const targetRel = relative(process.cwd(), r.target)
      if (flags.dryRun) {
        console.log(`   → ${targetRel} (dry-run)`)
      } else {
        const actionLabel = r.action === 'replaced' ? 'atualizado' : 'criado'
        console.log(`   → ${targetRel} [${actionLabel}]`)
      }
    }
    console.log()
  }

  const registry = await loadRegistry()

  // Auto-registra itens locais não catalogados nos JSONs
  const registered = await autoRegister(
    registry.skills,
    registry.commands,
    registry.hooks,
    flags.dryRun,
  )

  if (registered.skills.length > 0) {
    registered.skills.forEach(s =>
      console.log(`🆕 skill detectada e registrada: ${s.name} (${s.domain})`)
    )
    // Atualiza o registry em memória para incluir as novas skills
    registry.skills.push(...registered.skills)
    console.log()
  }
  if (registered.hooks.length > 0) {
    registered.hooks.forEach(h =>
      console.log(`🆕 hook detectado e registrado: ${h.name}`)
    )
    registry.hooks.push(...registered.hooks)
    console.log()
  }
  if (registered.rules.length > 0) {
    registered.rules.forEach(r =>
      console.log(`🆕 rule pack detectado: ${r} (meta injetado)`)
    )
    console.log()
  }

  // Gera _index.md legíveis para a IA a partir dos JSONs
  if (!flags.dryRun) {
    const indexFiles = await generateIndexFiles(
      registry.skills,
      registry.commands,
      registry.hooks,
    )
    if (indexFiles.length > 0) {
      indexFiles.forEach(f => console.log(`📋 ${relative(process.cwd(), f)} atualizado`))
      console.log()
    }
  }

  const toolEntries = Object.entries(config.tools).filter(([name, tool]) => {
    if (!tool.enabled) return false
    if (flags.only && name !== flags.only) return false
    return true
  })

  const skipped = Object.entries(config.tools).filter(([, t]) => !t.enabled)

  // When skills.targets is configured, the CursorAdapter should skip its
  // legacy mirrorHarnessAgentSkills step (skills are already linked above).
  const skillsLinkActive = !!config.skills

  for (const [toolName, toolConfig] of toolEntries) {
    const AdapterClass = ADAPTERS[toolName as ToolName]

    if (!AdapterClass) {
      console.warn(`⚠️  Adapter não implementado para: ${toolName}`)
      continue
    }

    const adapter = toolName === 'cursor'
      ? new CursorAdapter(toolConfig, project, registry, { skipSkillsMirror: skillsLinkActive })
      : new AdapterClass(toolConfig, project, registry)

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

  if (!flags.dryRun) {
    await printContextBudgetWarnings(config)
  }

  console.log('\n✨ harness sync concluído')
}
