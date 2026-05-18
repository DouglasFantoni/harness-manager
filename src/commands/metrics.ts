import { loadConfig } from '../config.js'
import {
    daysSince,
    isMetricsStale,
    isProposalsReviewStale,
    patchEvolutionTimestamps,
    resolveEvolutionConfig,
    todayIso,
} from '../evolution/config.js'
import { filterFeedbackEntries, readFeedbackEntries } from '../evolution/feedback.js'
import {
    buildMetricsReport,
    formatMetricsStdout,
    writeMetricsFile,
} from '../evolution/metrics.js'
import { listPendingProposals } from '../evolution/proposals.js'

function parseNumberFlag(args: string[], flag: string): number | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) return Number(args[i].split('=')[1])
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) return Number(args[i + 1])
  }
  return undefined
}

export async function runMetrics(args: string[]): Promise<void> {
  const write = args.includes('--write')
  const check = args.includes('--check')
  const sinceDays = parseNumberFlag(args, '--since')

  const { config } = await loadConfig()
  const evolution = resolveEvolutionConfig(config)

  const all = await readFeedbackEntries()
  const entries = filterFeedbackEntries(all, { sinceDays })
  const report = buildMetricsReport(entries)

  console.log(formatMetricsStdout(report))

  if (write) {
    await writeMetricsFile(report)
    await patchEvolutionTimestamps({ last_metrics_at: todayIso() })
    console.log('\n✅ evolution/metrics.md atualizado')
    console.log(`   last_metrics_at → ${todayIso()}`)
  }

  const pending = await listPendingProposals()
  const metricsStale = isMetricsStale(evolution)
  const proposalsStale = isProposalsReviewStale(evolution, pending.length)

  if (check || !write) {
    printScheduleHints(evolution, metricsStale, proposalsStale, pending.length)
  }

  if (check && (metricsStale || proposalsStale)) {
    process.exit(1)
  }
}

function printScheduleHints(
  evolution: ReturnType<typeof resolveEvolutionConfig>,
  metricsStale: boolean,
  proposalsStale: boolean,
  pendingCount: number,
): void {
  const lines: string[] = ['', '📅 Evolution schedule:']

  const metricsDays = daysSince(evolution.last_metrics_at)
  lines.push(
    metricsStale
      ? `   ⚠️  Métricas: atualize com \`harness metrics --write\` (intervalo: ${evolution.metrics_interval_days}d${metricsDays != null ? `, última há ${metricsDays}d` : ', nunca'})`
      : `   ✅ Métricas: ok (intervalo ${evolution.metrics_interval_days}d, última ${evolution.last_metrics_at})`,
  )

  if (pendingCount > 0) {
    const reviewDays = daysSince(evolution.last_proposals_review_at)
    lines.push(
      proposalsStale
        ? `   ⚠️  Proposals: ${pendingCount} pendente(s) — revise (intervalo: ${evolution.proposals_interval_days}d${reviewDays != null ? `, última revisão há ${reviewDays}d` : ', nunca'})`
        : `   ✅ Proposals: ${pendingCount} pendente(s), revisão em dia`,
    )
  } else {
    lines.push(`   ℹ️  Proposals: nenhum arquivo em evolution/proposed/`)
  }

  console.log(lines.join('\n'))
}
