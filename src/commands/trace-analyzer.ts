import { readFile, writeFile, readdir } from 'fs/promises'
import { resolve } from 'path'

function harnessDir() { return resolve(process.cwd(), '.harness') }
function tracesDir()  { return resolve(harnessDir(), 'evolution/traces') }

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TraceRecord {
  id: string
  timestamp: string
  tool: string
  task: string
  skills_loaded: string[]
  hooks_fired: string[]
  commands_run: string[]
  files_modified: string[]
  errors_encountered: string[]
  resolution: string
  revisions_needed: number
  outcome: string
  typecheck_passed: boolean | null
  tests_passed: boolean | null
  notes: string
}

export interface AnalysisFlag {
  type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  evidence: Record<string, unknown>
}

interface SkillStats {
  uses: number
  failed: number
  partial: number
  success: number
  failure_rate: number
  avg_revisions: number
  total_revisions: number
}

interface CommandStats {
  runs: number
  passed: number
  failed: number
  failure_rate: number
}

interface ComplianceStats {
  total: number
  complete: number
  incomplete: number
  completion_rate: number
  missing_fields: string[]
}

export interface AnalysisResult {
  generated_at: string
  total_traces: number
  period: { from: string; to: string }
  thresholds: Record<string, number>
  skills: Record<string, SkillStats>
  errors: Record<string, number>
  resolutions: Record<string, number>
  commands: Record<string, CommandStats>
  hooks: Record<string, number>
  tool_compliance: Record<string, ComplianceStats>
  flags: AnalysisFlag[]
}

// ─── Defaults dos thresholds ──────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: Record<string, number> = {
  skill_high_failure_rate:           0.20,
  skill_needs_clarity_avg_revisions: 2.0,
  skill_conflict_occurrences:        3,
  skill_missing_occurrences:         3,
  skill_glob_gap_files:              5,
  skill_domain_gap_occurrences:      5,
  recurring_error_count:             3,
  error_without_resolution_count:    3,
  tool_specific_error_count:         3,
  error_same_file_count:             3,
  typecheck_instability_rate:        0.25,
  tests_instability_rate:            0.20,
  no_validation_on_failure_count:    3,
  validation_skipped_count:          5,
  pre_task_ignored_count:            3,
  post_task_ignored_count:           5,
  on_error_frequent_rate:            0.30,
  recurring_resolution_count:        3,
  partial_ceiling_count:             5,
  degradation_rate:                  0.15,
  improvement_rate:                  0.10,
  incomplete_traces_rate:            0.20,
  tool_compliance_deviation:         0.30,
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runAnalyze(dryRun = false): Promise<AnalysisResult | null> {
  const traces = await loadAllTraces()
  if (traces.length === 0) {
    console.log('  Nenhum trace encontrado para analisar.')
    console.log('  Ative a gravação com: harness trace --record')
    return null
  }

  const thresholds = await loadThresholds()
  const context    = await loadContext()

  const result = analyze(traces, thresholds, context)

  if (!dryRun) {
    const outPath = resolve(tracesDir(), '_analysis.json')
    await writeFile(outPath, JSON.stringify(result, null, 2) + '\n', 'utf-8')
    console.log(`✅ Análise salva em evolution/traces/_analysis.json`)
  }

  return result
}

// ─── Análise principal ────────────────────────────────────────────────────────

function analyze(
  traces: TraceRecord[],
  thresholds: Record<string, number>,
  context: AnalysisContext,
): AnalysisResult {
  const t = thresholds
  const flags: AnalysisFlag[] = []

  // Agrega estatísticas brutas
  const skillStats     = aggregateSkills(traces)
  const errorCounts    = aggregateField(traces, 'errors_encountered')
  const resolutionCounts = aggregateField(traces, 'resolutions')
  const commandStats   = aggregateCommands(traces)
  const hookCounts     = aggregateHooksFired(traces)
  const toolCompliance = aggregateCompliance(traces)

  // ── Categoria: Skills ──────────────────────────────────────────────────────

  // skill_high_failure
  for (const [skill, stats] of Object.entries(skillStats)) {
    if (stats.uses >= 3 && stats.failure_rate > t.skill_high_failure_rate) {
      flags.push({
        type: 'skill_high_failure',
        severity: 'critical',
        message: `Skill "${skill}" falha em ${pct(stats.failure_rate)} das tasks — revisar regras e contexto essencial`,
        evidence: { skill, uses: stats.uses, failed: stats.failed, failure_rate: stats.failure_rate },
      })
    }
  }

  // skill_needs_clarity
  for (const [skill, stats] of Object.entries(skillStats)) {
    if (stats.uses >= 3 && stats.avg_revisions > t.skill_needs_clarity_avg_revisions) {
      flags.push({
        type: 'skill_needs_clarity',
        severity: 'warning',
        message: `Skill "${skill}" exige média de ${stats.avg_revisions.toFixed(1)} revisões — instruções podem estar ambíguas`,
        evidence: { skill, avg_revisions: stats.avg_revisions, uses: stats.uses },
      })
    }
  }

  // skill_conflict — múltiplas skills em tasks que falharam
  const conflictCases = traces.filter(
    tr => tr.outcome === 'failed' && tr.skills_loaded.length >= 2
  )
  const conflictPairs = countPairs(conflictCases.map(tr => tr.skills_loaded))
  for (const [pair, count] of Object.entries(conflictPairs)) {
    if (count >= t.skill_conflict_occurrences) {
      flags.push({
        type: 'skill_conflict',
        severity: 'warning',
        message: `Combinação de skills [${pair}] associada a ${count} falhas — verificar conflitos de instrução`,
        evidence: { pair, count },
      })
    }
  }

  // skill_missing — tasks sem skill que falharam
  const missingSkilledFailed = traces.filter(
    tr => tr.outcome === 'failed' && tr.skills_loaded.length === 0
  )
  if (missingSkilledFailed.length >= t.skill_missing_occurrences) {
    flags.push({
      type: 'skill_missing',
      severity: 'warning',
      message: `${missingSkilledFailed.length} tasks falharam sem nenhuma skill carregada — verificar globs de skills`,
      evidence: {
        count: missingSkilledFailed.length,
        tasks: missingSkilledFailed.slice(0, 3).map(tr => tr.task),
      },
    })
  }

  // skill_glob_gap — arquivos modificados sem skill correspondente
  if (context.skillGlobs.length > 0) {
    const unglobbedFiles = new Set<string>()
    for (const tr of traces) {
      for (const file of tr.files_modified) {
        const covered = context.skillGlobs.some(glob => matchGlob(glob, file))
        if (!covered) unglobbedFiles.add(file)
      }
    }
    if (unglobbedFiles.size >= t.skill_glob_gap_files) {
      const extensions = countExtensions([...unglobbedFiles])
      flags.push({
        type: 'skill_glob_gap',
        severity: 'info',
        message: `${unglobbedFiles.size} arquivos modificados sem cobertura de glob — considerar adicionar globs às skills`,
        evidence: { count: unglobbedFiles.size, top_extensions: extensions, examples: [...unglobbedFiles].slice(0, 5) },
      })
    }
  }

  // skill_domain_gap — palavras recorrentes em tasks sem skill correspondente
  const domainWords = extractDomainWords(traces, context.skillNames)
  for (const [word, count] of Object.entries(domainWords)) {
    if (count >= t.skill_domain_gap_occurrences) {
      flags.push({
        type: 'skill_domain_gap',
        severity: 'info',
        message: `Termo "${word}" aparece em ${count} tasks mas não tem skill correspondente — considerar criar skill`,
        evidence: { word, count },
      })
    }
  }

  // ── Categoria: Erros ───────────────────────────────────────────────────────

  // recurring_error
  for (const [err, count] of Object.entries(errorCounts)) {
    if (count >= t.recurring_error_count) {
      flags.push({
        type: 'recurring_error',
        severity: count >= t.recurring_error_count * 2 ? 'critical' : 'warning',
        message: `Erro recorrente (${count}x): "${truncate(err, 60)}" — candidato a virar regra`,
        evidence: { error: err, count },
      })
    }
  }

  // error_without_resolution
  const noResolution = traces.filter(
    tr => tr.errors_encountered.length > 0 && !tr.resolution
  )
  if (noResolution.length >= t.error_without_resolution_count) {
    flags.push({
      type: 'error_without_resolution',
      severity: 'warning',
      message: `${noResolution.length} traces têm erros sem resolução registrada — qualidade dos traces baixa`,
      evidence: { count: noResolution.length },
    })
  }

  // tool_specific_error — erro que aparece só numa tool
  const errorsByTool = groupErrorsByTool(traces)
  for (const [err, toolMap] of Object.entries(errorsByTool)) {
    const tools = Object.entries(toolMap)
    if (tools.length === 1 && tools[0][1] >= t.tool_specific_error_count) {
      const [tool, count] = tools[0]
      flags.push({
        type: 'tool_specific_error',
        severity: 'info',
        message: `Erro "${truncate(err, 50)}" ocorre só no ${tool} (${count}x) — pode ser problema de configuração da tool`,
        evidence: { error: err, tool, count },
      })
    }
  }

  // error_same_file — mesmo erro no mesmo arquivo
  const fileErrors = aggregateFileErrors(traces)
  for (const [key, count] of Object.entries(fileErrors)) {
    if (count >= t.error_same_file_count) {
      const [file, ...errParts] = key.split('::')
      flags.push({
        type: 'error_same_file',
        severity: 'warning',
        message: `Erro recorrente (${count}x) no mesmo arquivo "${file}" — pode indicar problema estrutural`,
        evidence: { file, error: errParts.join('::'), count },
      })
    }
  }

  // ── Categoria: Validação ──────────────────────────────────────────────────

  // typecheck_instability
  const typecheckRan = traces.filter(tr => tr.typecheck_passed !== null)
  if (typecheckRan.length >= 5) {
    const typecheckFailed  = typecheckRan.filter(tr => tr.typecheck_passed === false)
    const typecheckFailRate = typecheckFailed.length / typecheckRan.length
    if (typecheckFailRate > t.typecheck_instability_rate) {
      flags.push({
        type: 'typecheck_instability',
        severity: 'critical',
        message: `Typecheck falha em ${pct(typecheckFailRate)} das execuções — types do projeto podem estar instáveis`,
        evidence: { failure_rate: typecheckFailRate, failed: typecheckFailed.length, total: typecheckRan.length },
      })
    }
  }

  // tests_instability
  const testsRan = traces.filter(tr => tr.tests_passed !== null)
  if (testsRan.length >= 5) {
    const testsFailed   = testsRan.filter(tr => tr.tests_passed === false)
    const testsFailRate = testsFailed.length / testsRan.length
    if (testsFailRate > t.tests_instability_rate) {
      flags.push({
        type: 'tests_instability',
        severity: 'critical',
        message: `Testes falham em ${pct(testsFailRate)} das execuções — suite de testes pode estar quebrando`,
        evidence: { failure_rate: testsFailRate, failed: testsFailed.length, total: testsRan.length },
      })
    }
  }

  // no_validation_on_failure
  const failedNoCommands = traces.filter(
    tr => tr.outcome === 'failed' && tr.commands_run.length === 0
  )
  if (failedNoCommands.length >= t.no_validation_on_failure_count) {
    flags.push({
      type: 'no_validation_on_failure',
      severity: 'warning',
      message: `${failedNoCommands.length} tasks falharam sem rodar nenhum comando de validação`,
      evidence: { count: failedNoCommands.length, tasks: failedNoCommands.slice(0, 3).map(tr => tr.task) },
    })
  }

  // validation_skipped — tasks sem os comandos esperados do projeto
  if (context.expectedCommands.length > 0) {
    const skipped = traces.filter(tr =>
      context.expectedCommands.every(cmd => !tr.commands_run.some(r => r.includes(cmd)))
    )
    if (skipped.length >= t.validation_skipped_count) {
      flags.push({
        type: 'validation_skipped',
        severity: 'warning',
        message: `${skipped.length} tasks concluídas sem rodar os comandos de validação do projeto (${context.expectedCommands.join(', ')})`,
        evidence: { count: skipped.length, expected_commands: context.expectedCommands },
      })
    }
  }

  // ── Categoria: Hooks ──────────────────────────────────────────────────────

  // pre_task_ignored — tasks com revisões que não dispararam pre-task
  const preMissed = traces.filter(
    tr => tr.revisions_needed > 1 && !tr.hooks_fired.includes('pre-task')
  )
  if (preMissed.length >= t.pre_task_ignored_count) {
    flags.push({
      type: 'pre_task_ignored',
      severity: 'warning',
      message: `${preMissed.length} tasks com revisões múltiplas não dispararam pre-task — correlação entre pular pre-task e retrabalho`,
      evidence: { count: preMissed.length },
    })
  }

  // post_task_ignored — traces sem post-task
  const postMissed = traces.filter(tr => !tr.hooks_fired.includes('post-task'))
  if (postMissed.length >= t.post_task_ignored_count) {
    flags.push({
      type: 'post_task_ignored',
      severity: 'info',
      message: `${postMissed.length} traces sem post-task disparado — aprendizado da sessão pode estar sendo perdido`,
      evidence: { count: postMissed.length },
    })
  }

  // on_error_frequent
  const onErrorCount = traces.filter(tr => tr.hooks_fired.includes('on-error')).length
  const onErrorRate  = onErrorCount / traces.length
  if (traces.length >= 5 && onErrorRate > t.on_error_frequent_rate) {
    flags.push({
      type: 'on_error_frequent',
      severity: 'warning',
      message: `on-error dispara em ${pct(onErrorRate)} das tasks — frequência acima do esperado`,
      evidence: { rate: onErrorRate, count: onErrorCount, total: traces.length },
    })
  }

  // ── Categoria: Resoluções ─────────────────────────────────────────────────

  // recurring_resolution
  for (const [resolution, count] of Object.entries(resolutionCounts)) {
    if (count >= t.recurring_resolution_count && resolution) {
      flags.push({
        type: 'recurring_resolution',
        severity: 'info',
        message: `Resolução repetida (${count}x): "${truncate(resolution, 60)}" — considerar adicionar como regra permanente`,
        evidence: { resolution, count },
      })
    }
  }

  // resolution_contradicts_rule
  if (context.rulesContent) {
    const contradictions = findRuleContradictions(
      Object.keys(resolutionCounts),
      context.rulesContent,
    )
    for (const c of contradictions) {
      flags.push({
        type: 'resolution_contradicts_rule',
        severity: 'critical',
        message: `Resolução usada contradiz regra existente: "${truncate(c.resolution, 50)}" vs regra "${truncate(c.rule, 60)}"`,
        evidence: c,
      })
    }
  }

  // partial_ceiling — skill que nunca sai de partial
  for (const [skill, stats] of Object.entries(skillStats)) {
    const partialOnly = stats.partial >= t.partial_ceiling_count && stats.success === 0
    if (partialOnly) {
      flags.push({
        type: 'partial_ceiling',
        severity: 'warning',
        message: `Skill "${skill}" nunca alcança "success" — ${stats.partial} outcomes "partial" consecutivos`,
        evidence: { skill, partial: stats.partial, success: stats.success },
      })
    }
  }

  // ── Categoria: Degradação temporal ───────────────────────────────────────

  const sorted = [...traces].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // degradation — compara últimos 10 vs anteriores
  if (sorted.length >= 10) {
    const half     = Math.floor(sorted.length / 2)
    const earlier  = sorted.slice(0, half)
    const recent   = sorted.slice(-half)
    const rateEarly  = successRate(earlier)
    const rateRecent = successRate(recent)
    const drop       = rateEarly - rateRecent

    if (drop > t.degradation_rate) {
      flags.push({
        type: 'degradation',
        severity: 'critical',
        message: `Taxa de sucesso caiu ${pct(drop)} nas últimas ${half} tasks (${pct(rateEarly)} → ${pct(rateRecent)})`,
        evidence: { drop, earlier_rate: rateEarly, recent_rate: rateRecent, half_size: half },
      })
    }
  }

  // improvement_after_update — melhoria após changelog
  if (context.lastChangelogDate && sorted.length >= 6) {
    const before = sorted.filter(tr => tr.timestamp < context.lastChangelogDate!)
    const after  = sorted.filter(tr => tr.timestamp >= context.lastChangelogDate!)
    if (before.length >= 3 && after.length >= 3) {
      const rateBefore = successRate(before)
      const rateAfter  = successRate(after)
      const gain       = rateAfter - rateBefore

      if (gain > t.improvement_rate) {
        flags.push({
          type: 'improvement_after_update',
          severity: 'info',
          message: `Taxa de sucesso melhorou ${pct(gain)} após último harness-update (${pct(rateBefore)} → ${pct(rateAfter)})`,
          evidence: { gain, before_rate: rateBefore, after_rate: rateAfter, changelog_date: context.lastChangelogDate },
        })
      }
    }
  }

  // ── Categoria: Qualidade dos traces ──────────────────────────────────────

  const REQUIRED_FIELDS = ['tool', 'task', 'outcome'] as const
  const incompleteTraces = traces.filter(tr =>
    REQUIRED_FIELDS.some(f => !tr[f])
  )
  const incompleteRate = incompleteTraces.length / traces.length

  if (incompleteRate > t.incomplete_traces_rate) {
    flags.push({
      type: 'incomplete_traces',
      severity: 'warning',
      message: `${pct(incompleteRate)} dos traces têm campos obrigatórios vazios — qualidade dos dados comprometida`,
      evidence: { rate: incompleteRate, count: incompleteTraces.length, total: traces.length },
    })
  }

  // tool_compliance — tool com taxa de preenchimento muito menor
  const tools = Object.keys(toolCompliance)
  if (tools.length >= 2) {
    const rates = tools.map(t => toolCompliance[t].completion_rate)
    const maxRate = Math.max(...rates)
    for (const tool of tools) {
      const deviation = maxRate - toolCompliance[tool].completion_rate
      if (deviation > t.tool_compliance_deviation) {
        flags.push({
          type: 'tool_compliance',
          severity: 'info',
          message: `${tool} preenche traces ${pct(deviation)} menos que outras tools — pode estar ignorando instruções de gravação`,
          evidence: {
            tool,
            completion_rate: toolCompliance[tool].completion_rate,
            best_rate: maxRate,
            deviation,
          },
        })
      }
    }
  }

  // ── Resultado final ───────────────────────────────────────────────────────

  const timestamps = sorted.map(tr => tr.timestamp).filter(Boolean)

  return {
    generated_at: new Date().toISOString(),
    total_traces: traces.length,
    period: {
      from: timestamps[0] ?? '',
      to:   timestamps[timestamps.length - 1] ?? '',
    },
    thresholds,
    skills:          skillStats,
    errors:          errorCounts,
    resolutions:     resolutionCounts,
    commands:        commandStats,
    hooks:           hookCounts,
    tool_compliance: toolCompliance,
    flags: flags.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 }
      return order[a.severity] - order[b.severity]
    }),
  }
}

// ─── Contexto externo ─────────────────────────────────────────────────────────

interface AnalysisContext {
  skillGlobs: string[]
  skillNames: string[]
  expectedCommands: string[]
  rulesContent: string
  lastChangelogDate: string | null
}

async function loadContext(): Promise<AnalysisContext> {
  const [skillGlobs, skillNames] = await loadSkillContext()
  const expectedCommands         = await loadExpectedCommands()
  const rulesContent             = await loadRulesContent()
  const lastChangelogDate        = await loadLastChangelogDate()

  return { skillGlobs, skillNames, expectedCommands, rulesContent, lastChangelogDate }
}

async function loadSkillContext(): Promise<[string[], string[]]> {
  try {
    const raw = await readFile(resolve(harnessDir(), 'skills/index.json'), 'utf-8')
    const { skills } = JSON.parse(raw) as { skills: Array<{ name: string; globs?: string[] }> }
    const globs = skills.flatMap(s => s.globs ?? [])
    const names = skills.map(s => s.name).filter(n => !n.startsWith('_'))
    return [globs, names]
  } catch {
    return [[], []]
  }
}

async function loadExpectedCommands(): Promise<string[]> {
  try {
    const raw  = await readFile(resolve(process.cwd(), '.harness/project-details.json'), 'utf-8')
    const data = JSON.parse(raw)
    const cmds = data?.commands ?? {}
    return [cmds.typecheck, cmds.lint, cmds.test].filter(Boolean)
  } catch {
    return []
  }
}

async function loadRulesContent(): Promise<string> {
  try {
    return await readFile(resolve(harnessDir(), 'core/rules.md'), 'utf-8')
  } catch {
    return ''
  }
}

async function loadLastChangelogDate(): Promise<string | null> {
  try {
    const raw = await readFile(resolve(harnessDir(), 'evolution/changelog.md'), 'utf-8')
    const match = raw.match(/##\s+(\d{4}-\d{2}-\d{2})/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

async function loadThresholds(): Promise<Record<string, number>> {
  try {
    const raw  = await readFile(resolve(process.cwd(), '.harness/harness.config.json'), 'utf-8')
    const cfg  = JSON.parse(raw)
    const from = cfg?.trace_analysis?.thresholds ?? {}
    return { ...DEFAULT_THRESHOLDS, ...from }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

// ─── Loaders de traces ────────────────────────────────────────────────────────

async function loadAllTraces(): Promise<TraceRecord[]> {
  const traces: TraceRecord[] = []
  try {
    const files = await readdir(tracesDir())
    const jsonFiles = files
      .filter(f => f.endsWith('.json') && !f.startsWith('_'))
      .sort()

    for (const file of jsonFiles) {
      try {
        const raw = await readFile(resolve(tracesDir(), file), 'utf-8')
        traces.push(JSON.parse(raw) as TraceRecord)
      } catch {}
    }
  } catch {}
  return traces
}

// ─── Agregações ───────────────────────────────────────────────────────────────

function aggregateSkills(traces: TraceRecord[]): Record<string, SkillStats> {
  const stats: Record<string, SkillStats> = {}

  for (const tr of traces) {
    for (const skill of tr.skills_loaded) {
      if (!stats[skill]) {
        stats[skill] = { uses: 0, failed: 0, partial: 0, success: 0, failure_rate: 0, avg_revisions: 0, total_revisions: 0 }
      }
      stats[skill].uses++
      stats[skill].total_revisions += tr.revisions_needed ?? 0
      if (tr.outcome === 'failed')  stats[skill].failed++
      if (tr.outcome === 'partial') stats[skill].partial++
      if (tr.outcome === 'success') stats[skill].success++
    }
  }

  for (const s of Object.values(stats)) {
    s.failure_rate   = s.uses > 0 ? s.failed / s.uses : 0
    s.avg_revisions  = s.uses > 0 ? s.total_revisions / s.uses : 0
  }

  return stats
}

function aggregateField(
  traces: TraceRecord[],
  field: 'errors_encountered' | 'resolutions',
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tr of traces) {
    const values = field === 'resolutions'
      ? (tr.resolution ? [tr.resolution] : [])
      : tr.errors_encountered ?? []
    for (const v of values) {
      const key = v.trim()
      if (key) counts[key] = (counts[key] ?? 0) + 1
    }
  }
  return counts
}

function aggregateCommands(traces: TraceRecord[]): Record<string, CommandStats> {
  const stats: Record<string, CommandStats> = {}

  for (const tr of traces) {
    for (const cmd of tr.commands_run ?? []) {
      if (!stats[cmd]) stats[cmd] = { runs: 0, passed: 0, failed: 0, failure_rate: 0 }
      stats[cmd].runs++
      // Infere resultado do comando pelo outcome geral (heurística)
      if (tr.outcome === 'success') stats[cmd].passed++
      else stats[cmd].failed++
    }
  }

  // Ajusta com typecheck e test explícitos
  for (const tr of traces) {
    for (const cmd of tr.commands_run ?? []) {
      if (cmd.includes('typecheck') && tr.typecheck_passed !== null) {
        if (!stats[cmd]) stats[cmd] = { runs: 0, passed: 0, failed: 0, failure_rate: 0 }
        stats[cmd].passed += tr.typecheck_passed ? 1 : 0
        stats[cmd].failed += tr.typecheck_passed ? 0 : 1
      }
      if ((cmd.includes('test') && !cmd.includes('typecheck')) && tr.tests_passed !== null) {
        if (!stats[cmd]) stats[cmd] = { runs: 0, passed: 0, failed: 0, failure_rate: 0 }
        stats[cmd].passed += tr.tests_passed ? 1 : 0
        stats[cmd].failed += tr.tests_passed ? 0 : 1
      }
    }
  }

  for (const s of Object.values(stats)) {
    s.failure_rate = s.runs > 0 ? s.failed / s.runs : 0
  }

  return stats
}

function aggregateHooksFired(traces: TraceRecord[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tr of traces) {
    for (const hook of tr.hooks_fired ?? []) {
      counts[hook] = (counts[hook] ?? 0) + 1
    }
  }
  return counts
}

function aggregateCompliance(traces: TraceRecord[]): Record<string, ComplianceStats> {
  const CRITICAL_FIELDS: (keyof TraceRecord)[] = ['tool', 'task', 'outcome', 'skills_loaded']
  const byTool: Record<string, ComplianceStats> = {}

  for (const tr of traces) {
    const tool = tr.tool || 'unknown'
    if (!byTool[tool]) {
      byTool[tool] = { total: 0, complete: 0, incomplete: 0, completion_rate: 0, missing_fields: [] }
    }
    byTool[tool].total++

    const missingFields = CRITICAL_FIELDS.filter(f => {
      const v = tr[f]
      return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
    }).map(String)

    if (missingFields.length === 0) {
      byTool[tool].complete++
    } else {
      byTool[tool].incomplete++
      for (const f of missingFields) {
        if (!byTool[tool].missing_fields.includes(f)) {
          byTool[tool].missing_fields.push(f)
        }
      }
    }
  }

  for (const s of Object.values(byTool)) {
    s.completion_rate = s.total > 0 ? s.complete / s.total : 0
  }

  return byTool
}

// ─── Helpers de análise ───────────────────────────────────────────────────────

function countPairs(lists: string[][]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const list of lists) {
    const sorted = [...list].sort()
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}, ${sorted[j]}`
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
  }
  return counts
}

function groupErrorsByTool(traces: TraceRecord[]): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {}
  for (const tr of traces) {
    for (const err of tr.errors_encountered ?? []) {
      if (!result[err]) result[err] = {}
      const tool = tr.tool || 'unknown'
      result[err][tool] = (result[err][tool] ?? 0) + 1
    }
  }
  return result
}

function aggregateFileErrors(traces: TraceRecord[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const tr of traces) {
    for (const file of tr.files_modified ?? []) {
      for (const err of tr.errors_encountered ?? []) {
        const key = `${file}::${err}`
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
  }
  return counts
}

function countExtensions(files: string[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const file of files) {
    const ext = file.split('.').pop() ?? 'unknown'
    counts[ext] = (counts[ext] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  )
}

function extractDomainWords(traces: TraceRecord[], knownSkills: string[]): Record<string, number> {
  const STOP_WORDS = new Set([
    'a', 'o', 'e', 'de', 'do', 'da', 'em', 'no', 'na', 'um', 'uma',
    'para', 'com', 'por', 'que', 'se', 'ao', 'os', 'as', 'ou',
    'implementar', 'criar', 'adicionar', 'corrigir', 'atualizar',
    'refatorar', 'revisar', 'testar', 'verificar', 'alterar',
  ])

  const wordCounts: Record<string, number> = {}
  for (const tr of traces) {
    const words = (tr.task ?? '')
      .toLowerCase()
      .replace(/[^a-záéíóúãõâêîôûç\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))

    for (const word of words) {
      const alreadySkill = knownSkills.some(s => s.toLowerCase().includes(word))
      if (!alreadySkill) {
        wordCounts[word] = (wordCounts[word] ?? 0) + 1
      }
    }
  }

  return wordCounts
}

function findRuleContradictions(
  resolutions: string[],
  rulesContent: string,
): Array<{ resolution: string; rule: string }> {
  const contradictions: Array<{ resolution: string; rule: string }> = []
  const negationLines = rulesContent
    .split('\n')
    .filter(l => /\bnunca\b|\bnão\b|\bevitar\b/i.test(l))

  for (const resolution of resolutions) {
    if (!resolution) continue
    const resWords = resolution.toLowerCase().split(/\s+/).filter(w => w.length > 4)

    for (const ruleLine of negationLines) {
      const ruleWords = ruleLine.toLowerCase().split(/\s+/)
      const overlap = resWords.filter(w => ruleWords.includes(w))
      if (overlap.length >= 2) {
        contradictions.push({ resolution, rule: ruleLine.trim() })
      }
    }
  }

  return contradictions
}

function successRate(traces: TraceRecord[]): number {
  if (!traces.length) return 0
  return traces.filter(tr => tr.outcome === 'success').length / traces.length
}

function matchGlob(glob: string, file: string): boolean {
  const pattern = glob
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.+')
    .replace(/\*/g, '[^/]+')
  return new RegExp(pattern).test(file)
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}


