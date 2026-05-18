import { loadConfig } from '../config.js'
import {
    daysSince,
    isMetricsStale,
    isProposalsReviewStale,
    patchEvolutionTimestamps,
    resolveEvolutionConfig,
    todayIso,
} from '../evolution/config.js'
import { readFeedbackEntries } from '../evolution/feedback.js'
import { listPendingProposals } from '../evolution/proposals.js'

export async function runEvolution(args: string[]): Promise<void> {
  const sub = args[0]

  if (sub === 'status') {
    await runEvolutionStatus()
    return
  }

  if (sub === 'review') {
    await runEvolutionReview()
    return
  }

  console.log(`
  harness evolution — evolution loop maintenance

    harness evolution status     Show intervals, last runs, pending proposals
    harness evolution review     Mark proposals as reviewed (updates config)

  Proposals: harness proposals propose | list | show | apply | reject
`)
}

async function runEvolutionStatus(): Promise<void> {
  const { config } = await loadConfig()
  const evolution = resolveEvolutionConfig(config)
  const pending = await listPendingProposals()
  const feedback = await readFeedbackEntries()

  console.log('🧬 Evolution status\n')
  console.log(`   metrics_interval_days:     ${evolution.metrics_interval_days}`)
  console.log(`   proposals_interval_days:   ${evolution.proposals_interval_days}`)
  console.log(`   last_metrics_at:           ${evolution.last_metrics_at ?? '(never)'}`)
  console.log(`   last_proposals_review_at:  ${evolution.last_proposals_review_at ?? '(never)'}`)
  console.log(`   feedback entries:          ${feedback.length}`)
  console.log(`   pending proposals:         ${pending.length}`)

  if (pending.length > 0) {
    console.log('\n   Pending:')
    for (const p of pending) {
      console.log(`   • ${p.id} — harness proposals show ${p.id}`)
    }
  }

  const metricsStale = isMetricsStale(evolution)
  const proposalsStale = isProposalsReviewStale(evolution, pending.length)

  console.log('')
  if (metricsStale) {
    const d = daysSince(evolution.last_metrics_at)
    console.log(
      `   ⚠️  Metrics due — run: harness metrics --write (${d ?? '∞'}d since last)`,
    )
  } else {
    console.log('   ✅ Metrics schedule ok')
  }

  if (proposalsStale) {
    const d = daysSince(evolution.last_proposals_review_at)
    console.log(
      `   ⚠️  Proposals review due (${d ?? '∞'}d since last) — then: harness evolution review`,
    )
  } else if (pending.length > 0) {
    console.log('   ✅ Proposals review schedule ok (pending files exist)')
  }
}

async function runEvolutionReview(): Promise<void> {
  const pending = await listPendingProposals()
  await patchEvolutionTimestamps({ last_proposals_review_at: todayIso() })
  console.log(`✅ Proposals marked as reviewed (${todayIso()})`)
  if (pending.length > 0) {
    console.log(`   ${pending.length} file(s) still in evolution/proposed/ (not deleted)`)
  }
}
