#!/usr/bin/env node
import { runInit } from './commands/init.js'
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
`

async function main() {
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE)
    process.exit(0)
  }

  if (command === 'init') {
    await runInit(args)
    return
  }

  if (command === 'sync') {
    await runSync({
      dryRun: args.includes('--dry-run'),
      forceContext: args.includes('--force-context'),
      only: args.find(a => a.startsWith('--only='))?.split('=')[1]
        ?? (args.includes('--only') ? args[args.indexOf('--only') + 1] : undefined),
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
