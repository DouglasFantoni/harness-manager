import { watch } from 'fs'
import { resolve } from 'path'
import { runSync } from './sync.js'
import type { SyncFlags } from './types.js'

const DEBOUNCE_MS = 400

/** Paths under `.harness/` that sync writes — ignored to avoid watch loops. */
const IGNORE_PREFIXES = [
  'adapters/',
  'core/context.md',
]

function shouldIgnore(filename: string | null): boolean {
  if (!filename) return false
  const normalized = filename.replace(/\\/g, '/')
  return IGNORE_PREFIXES.some(p => normalized.includes(p))
}

/**
 * Watches `.harness/` and re-runs sync on changes (debounced).
 * Skips events while a sync is in progress and ignores generated paths.
 */
export async function runSyncWatch(flags: SyncFlags): Promise<void> {
  const harnessDir = resolve(process.cwd(), '.harness')
  let debounce: ReturnType<typeof setTimeout> | null = null
  let isSyncing = false

  const runOnce = async (reason: string) => {
    if (isSyncing) return
    isSyncing = true
    try {
      if (reason) console.log(`\n👀 ${reason}\n`)
      await runSync(flags)
    } finally {
      isSyncing = false
    }
  }

  console.log(`👁️  Watching ${harnessDir}`)
  console.log('   Ctrl+C to stop\n')

  await runOnce('Initial sync')

  watch(harnessDir, { recursive: true }, (_event, filename) => {
    if (shouldIgnore(filename)) return
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      void runOnce(`Change detected: ${filename ?? '.harness'}`)
    }, DEBOUNCE_MS)
  })

  await new Promise<void>((resolve) => {
    const onSignal = () => {
      console.log('\n👋 Stopped watching.')
      resolve()
    }
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
  })
}
