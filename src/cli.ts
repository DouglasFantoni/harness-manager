#!/usr/bin/env node
import { runInit } from './commands/init.js'
import { runSync } from './sync.js'
import { runPrompt } from './commands/prompt.js'
import { runSkillSync, runSkillAdd } from './commands/skill-sync.js'

const [,, command, ...args] = process.argv

const USAGE = `
  AI Harness — usage:

    npx @ai-harness/cli init             Bootstrap harness in current project
    harness sync                         Regenerate adapters for active tools
    harness sync --dry-run               Preview without writing files
    harness sync --only cursor           Only generate for one tool
    harness sync --only claude-code
    harness sync --force-context         Force context.md regeneration

    harness prompt <nome>                Exibe prompt pronto para copiar e colar na IA
    harness prompt --list                Lista todos os prompts disponíveis

    harness skill-add <nome>             Instala skill da registry oficial
    harness skill-sync                   Atualiza todas as skills com source
    harness skill-sync <nome>            Atualiza uma skill específica
    harness skill-sync --check           Mostra quais têm update disponível
    harness skill-sync --dry-run         Mostra diff sem aplicar
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
    await runSync({
      dryRun: args.includes('--dry-run'),
      forceContext: args.includes('--force-context'),
      only: parseFlag(args, '--only'),
    })
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
