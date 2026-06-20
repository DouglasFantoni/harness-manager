import { readFile, writeFile, unlink, readdir, mkdir, access } from 'fs/promises'
import { runAnalyze } from './trace-analyzer.js'
import { resolve } from 'path'
import { createInterface } from 'readline'

function harnessDir()  { return resolve(process.cwd(), '.harness') }
function tracesDir()   { return resolve(harnessDir(), 'evolution/traces') }
function recordingFlag() { return resolve(tracesDir(), '.recording') }

// ─── Comando público ──────────────────────────────────────────────────────────

export async function runTrace(args: string[]): Promise<void> {
  const sub = args[0]

  switch (sub) {
    case '--record':  return recordStart()
    case '--stop':    return recordStop()
    case '--status':  return recordStatus()
    case '--list':    return listTraces()
    case '--clear':   return clearTraces()
    case '--show':    return showTrace(args[1])
    case '--analyze': return analyze(args.includes('--dry-run'))
    default:
      printUsage()
      process.exit(1)
  }
}

// ─── Subcomandos ──────────────────────────────────────────────────────────────

async function recordStart(): Promise<void> {
  await mkdir(tracesDir(), { recursive: true })

  if (await fileExists(recordingFlag())) {
    const traces = await listJsonTraces()
    console.log(`ℹ️  Gravação já está ativa.`)
    console.log(`   ${traces.length} trace(s) coletado(s) até agora.`)
    console.log(`   Para parar: harness trace --stop`)
    return
  }

  await writeFile(recordingFlag(), new Date().toISOString(), 'utf-8')
  console.log('● Gravação de traces ativada.\n')
  console.log('  O post-task.md vai instruir a IA a salvar um trace')
  console.log('  ao final de cada task concluída.\n')
  console.log('  Para parar: harness trace --stop')
  console.log('  Para ver coletados: harness trace --list')
}

async function recordStop(): Promise<void> {
  if (!(await fileExists(recordingFlag()))) {
    console.log('ℹ️  Gravação não estava ativa.')
    return
  }

  await unlink(recordingFlag())
  const traces = await listJsonTraces()
  console.log(`■ Gravação desativada. ${traces.length} trace(s) coletado(s).`)
  if (traces.length > 0) {
    console.log('\n  Para ver os traces: harness trace --list')
    console.log('  Para usar no harness-update: /harness-update')
  }
}

async function recordStatus(): Promise<void> {
  const active = await fileExists(recordingFlag())
  const traces = await listJsonTraces()

  if (active) {
    const since = await readFile(recordingFlag(), 'utf-8').catch(() => '')
    const sinceDate = since ? new Date(since).toLocaleDateString('pt-BR') : '?'
    console.log(`● Gravação ativa desde ${sinceDate}`)
  } else {
    console.log('■ Gravação inativa')
  }

  console.log(`  Traces coletados: ${traces.length}`)

  if (traces.length > 0) {
    const last = await loadTrace(traces[traces.length - 1])
    if (last) {
      console.log(`  Última task: "${last.task}" (${last.tool}) — ${last.outcome}`)
    }
  }

  if (!active && traces.length > 0) {
    console.log('\n  Para nova rodada: harness trace --record')
    console.log('  Para usar no harness-update: /harness-update')
  }
}

async function listTraces(): Promise<void> {
  const files = await listJsonTraces()

  if (files.length === 0) {
    console.log('  Nenhum trace coletado ainda.')
    console.log('  Para ativar: harness trace --record')
    return
  }

  const rows: Array<{ id: string; tool: string; task: string; outcome: string; date: string }> = []

  for (const file of files.slice().reverse()) { // mais recente primeiro
    const trace = await loadTrace(file)
    if (!trace) continue
    rows.push({
      id:      file.replace('.json', '').split('-').slice(0, 3).join('-'),
      tool:    trace.tool || '?',
      task:    truncate(trace.task || '?', 40),
      outcome: trace.outcome || '?',
      date:    formatDate(trace.timestamp ?? ''),
    })
  }

  const idW      = Math.max(20, ...rows.map(r => r.id.length))
  const toolW    = Math.max(4, ...rows.map(r => r.tool.length))
  const taskW    = Math.max(4, ...rows.map(r => r.task.length))
  const outcomeW = Math.max(7, ...rows.map(r => r.outcome.length))

  const header = `${'ID'.padEnd(idW)}  ${'Tool'.padEnd(toolW)}  ${'Task'.padEnd(taskW)}  ${'Outcome'.padEnd(outcomeW)}  Data`
  console.log('\n' + header)
  console.log('─'.repeat(header.length + 2))

  for (const row of rows) {
    const outcomeIcon = row.outcome === 'success' ? '✅' : row.outcome === 'partial' ? '⚠️ ' : '❌'
    console.log(
      `${row.id.padEnd(idW)}  ${row.tool.padEnd(toolW)}  ${row.task.padEnd(taskW)}  ${outcomeIcon} ${row.outcome.padEnd(outcomeW - 2)}  ${row.date}`
    )
  }
  console.log()
}

async function showTrace(idPrefix?: string): Promise<void> {
  if (!idPrefix) {
    console.error('❌ Informe o id do trace: harness trace --show <id>')
    process.exit(1)
  }

  const files = await listJsonTraces()
  const match = files.filter(f => f.startsWith(idPrefix))

  if (match.length === 0) {
    console.error(`❌ Nenhum trace encontrado com id "${idPrefix}"`)
    process.exit(1)
  }

  if (match.length > 1) {
    console.error(`❌ Prefixo ambíguo — ${match.length} traces encontrados:`)
    match.forEach(f => console.log(`   ${f}`))
    process.exit(1)
  }

  const trace = await loadTrace(match[0])
  if (!trace) {
    console.error(`❌ Erro ao ler trace ${match[0]}`)
    process.exit(1)
  }

  console.log('\n' + JSON.stringify(trace, null, 2) + '\n')
}

async function clearTraces(): Promise<void> {
  const files = await listJsonTraces()

  if (files.length === 0) {
    console.log('  Nenhum trace para remover.')
    return
  }

  const confirmed = await confirm(
    `Remover ${files.length} trace(s)? Esta ação não pode ser desfeita. (s/N) `
  )

  if (!confirmed) {
    console.log('  Cancelado.')
    return
  }

  for (const file of files) {
    await unlink(resolve(tracesDir(), file))
  }

  console.log(`✅ ${files.length} trace(s) removido(s).`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function listJsonTraces(): Promise<string[]> {
  try {
    const entries = await readdir(tracesDir())
    return entries
      .filter(f => f.endsWith('.json') && f !== '_template.json')
      .sort() // ordem cronológica pelo nome do arquivo
  } catch {
    return []
  }
}

interface TraceData {
  task?: string
  tool?: string
  timestamp?: string
  outcome?: string
  [key: string]: unknown
}

async function loadTrace(fileName: string): Promise<TraceData | null> {
  try {
    const raw = await readFile(resolve(tracesDir(), fileName), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function formatDate(timestamp: string): string {
  if (!timestamp) return '?'
  try {
    return new Date(timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3'))
      .toLocaleDateString('pt-BR')
  } catch {
    return timestamp.slice(0, 10)
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim')
    })
  })
}

async function analyze(dryRun: boolean): Promise<void> {
  console.log('🔍 Analisando traces...\n')
  const result = await runAnalyze(dryRun)
  if (!result) return

  // Imprime resumo no terminal
  const critical = result.flags.filter(f => f.severity === 'critical')
  const warnings  = result.flags.filter(f => f.severity === 'warning')
  const infos     = result.flags.filter(f => f.severity === 'info')

  console.log(`📊 ${result.total_traces} traces analisados (${result.period.from?.slice(0,10) ?? '?'} → ${result.period.to?.slice(0,10) ?? '?'})`)
  console.log(`   Skills: ${Object.keys(result.skills).length} | Erros únicos: ${Object.keys(result.errors).length}`)
  console.log()

  if (result.flags.length === 0) {
    console.log('✅ Nenhum padrão problemático detectado.')
    return
  }

  if (critical.length > 0) {
    console.log(`❌ ${critical.length} crítico(s):`)
    critical.forEach(f => console.log(`   • ${f.message}`))
    console.log()
  }
  if (warnings.length > 0) {
    console.log(`⚠️  ${warnings.length} aviso(s):`)
    warnings.forEach(f => console.log(`   • ${f.message}`))
    console.log()
  }
  if (infos.length > 0) {
    console.log(`ℹ️  ${infos.length} informativo(s):`)
    infos.forEach(f => console.log(`   • ${f.message}`))
    console.log()
  }

  if (!dryRun) {
    console.log('\n  Para aplicar melhorias: /harness-update')
  }
}

function printUsage(): void {
  console.log(`
Uso: harness trace <subcomando>

  --record          Ativa gravação de traces
  --stop            Desativa gravação
  --status          Mostra estado atual e resumo
  --list            Lista traces coletados
  --show <id>       Exibe trace completo (aceita prefixo)
  --clear           Remove todos os traces (pede confirmação)
  --analyze         Analisa todos os traces e gera _analysis.json
  --analyze --dry-run  Mostra análise sem salvar
  `)
}
