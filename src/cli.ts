#!/usr/bin/env node
import { runEvolution } from './commands/evolution.js'
import { runFeedback } from './commands/feedback.js'
import { runInit } from './commands/init.js'
import { runMemory } from './commands/memory.js'
import { runMetrics } from './commands/metrics.js'
import { runPrompt } from './commands/prompt.js'
import { runProposals } from './commands/proposals.js'
import { runRuleAdd, runRuleSync } from './commands/rule-sync.js'
import { runTrace } from './commands/trace.js'
import { runSkillAdd, runSkillSync } from './commands/skill-sync.js'
import { runSyncWatch } from './sync-watch.js'
import { runSync } from './sync.js'

const [,, command, ...args] = process.argv

const USAGE = `
  AI Harness — usage:

    npx @ai-harness/cli init             Bootstrap harness in current project
    harness sync                         Regenerate adapters for active tools
    harness sync --dry-run               Preview without writing files
    harness sync --only cursor           Only generate for one tool
    harness sync --only claude-code
    harness sync --force-context         Force context.md regeneration
    harness sync --watch                 Re-run sync when .harness/ changes

    harness memory status                Token counts for memory/*.md
    harness memory summarize [--backup]  AI summarize prompt when over threshold

    harness prompt <nome>                Exibe prompt pronto para copiar e colar na IA
    harness prompt --list                Lista todos os prompts disponíveis

    harness skill-add <nome|@scope/nome|url>  Instala skill (registry oficial, scope ou URL)
    harness skill-sync                   Atualiza todas as skills com source
    harness skill-sync <nome>            Atualiza uma skill específica
    harness skill-sync --check           Mostra quais têm update disponível
    harness skill-sync --dry-run         Mostra diff sem aplicar

    harness rule-add <nome|@scope/nome|url>   Instala rule pack (registry oficial, scope ou URL)
    harness rule-sync                    Atualiza todos os rule packs com source
    harness rule-sync <nome>             Atualiza um rule pack específico
    harness rule-sync --check            Mostra quais têm update disponível
    harness rule-sync --dry-run          Mostra diff sem aplicar

    harness trace --record               Ativa gravação de traces
    harness trace --stop                 Desativa gravação
    harness trace --status               Estado atual e resumo
    harness trace --list                 Lista traces coletados
    harness trace --show <id>            Exibe trace completo
    harness trace --clear                Remove todos os traces

    harness feedback add --task "..." --outcome success --confidence 4
    harness feedback list [--since 7] [--json]

    harness metrics [--write] [--check] [--since 30]
    harness evolution status
    harness evolution review

    harness proposals propose --target memory/mistakes.md --title "..." --body "..."
    harness proposals list [--status pending]
    harness proposals show <id>
    harness proposals apply <id> [--yes]
    harness proposals reject <id> [--reason "..."]
`


// Parseia flags no formato --flag=value ou --flag value
function parseFlag(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) return args[i].split('=')[1]
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1]
  }
  return undefined
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE)
    process.exit(0)
  }

  if (command === 'init') {
    await runInit(args)
    return
  }

  if (command === 'trace') {
    await runTrace(args)
    return
  }

  if (command === 'rule-add') {
    await runRuleAdd(args)
    return
  }

  if (command === 'rule-sync') {
    await runRuleSync(args)
    return
  }

  if (command === 'skill-add') {
    await runSkillAdd(args)
    return
  }

  if (command === 'skill-sync') {
    await runSkillSync(args)
    return
  }

  if (command === 'prompt') {
    await runPrompt(args)
    return
  }

  if (command === 'sync') {
    const flags = {
      dryRun: args.includes('--dry-run'),
      forceContext: args.includes('--force-context'),
      only: parseFlag(args, '--only'),
      watch: args.includes('--watch'),
    }
    if (flags.watch) {
      await runSyncWatch(flags)
    } else {
      await runSync(flags)
    }
    return
  }

  if (command === 'memory') {
    await runMemory(args)
    return
  }

  if (command === 'feedback') {
    await runFeedback(args)
    return
  }

  if (command === 'metrics') {
    await runMetrics(args)
    return
  }

  if (command === 'evolution') {
    await runEvolution(args)
    return
  }

  if (command === 'proposals') {
    await runProposals(args)
    return
  }

  console.error(`❌ Comando desconhecido: "${command}"`)
  console.log(USAGE)
  process.exit(1)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
