import { readFile, writeFile } from 'fs/promises'
import type { EvolutionConfig, HarnessConfig } from '../types.js'
import { configPath } from './paths.js'

export const DEFAULT_METRICS_INTERVAL_DAYS = 7
export const DEFAULT_PROPOSALS_INTERVAL_DAYS = 14

export function resolveEvolutionConfig(config: HarnessConfig): Required<EvolutionConfig> {
  const e: Partial<EvolutionConfig> = config.evolution ?? {}
  return {
    metrics_interval_days: e.metrics_interval_days ?? DEFAULT_METRICS_INTERVAL_DAYS,
    proposals_interval_days: e.proposals_interval_days ?? DEFAULT_PROPOSALS_INTERVAL_DAYS,
    last_metrics_at: e.last_metrics_at ?? null,
    last_proposals_review_at: e.last_proposals_review_at ?? null,
  }
}

export function validateEvolutionConfig(config: HarnessConfig): void {
  const e = config.evolution
  if (!e) return

  for (const [key, value] of [
    ['metrics_interval_days', e.metrics_interval_days],
    ['proposals_interval_days', e.proposals_interval_days],
  ] as const) {
    if (value === undefined) continue
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`harness.config.json: evolution.${key} deve ser um inteiro >= 1`)
    }
  }

  for (const [key, value] of [
    ['last_metrics_at', e.last_metrics_at],
    ['last_proposals_review_at', e.last_proposals_review_at],
  ] as const) {
    if (value == null || value === '') continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`harness.config.json: evolution.${key} deve ser YYYY-MM-DD ou null`)
    }
  }
}

export function daysSince(isoDate: string | null | undefined, today = new Date()): number | null {
  if (!isoDate) return null
  const then = new Date(`${isoDate}T00:00:00`)
  const now = new Date(today.toISOString().slice(0, 10) + 'T00:00:00')
  const diff = now.getTime() - then.getTime()
  return Math.floor(diff / (24 * 60 * 60 * 1000))
}

export function isMetricsStale(evolution: Required<EvolutionConfig>, today = new Date()): boolean {
  const since = daysSince(evolution.last_metrics_at, today)
  if (since === null) return true
  return since >= evolution.metrics_interval_days
}

export function isProposalsReviewStale(
  evolution: Required<EvolutionConfig>,
  pendingCount: number,
  today = new Date(),
): boolean {
  if (pendingCount === 0) return false
  const since = daysSince(evolution.last_proposals_review_at, today)
  if (since === null) return true
  return since >= evolution.proposals_interval_days
}

export function todayIso(today = new Date()): string {
  return today.toISOString().slice(0, 10)
}

export async function patchEvolutionTimestamps(
  patch: Partial<Pick<EvolutionConfig, 'last_metrics_at' | 'last_proposals_review_at'>>,
): Promise<void> {
  const raw = await readFile(configPath(), 'utf-8')
  const config = JSON.parse(raw) as HarnessConfig
  config.evolution = {
    ...resolveEvolutionConfig(config),
    ...config.evolution,
    ...patch,
  }
  await writeFile(configPath(), JSON.stringify(config, null, 2) + '\n', 'utf-8')
}
