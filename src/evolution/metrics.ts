import { writeFile } from 'fs/promises'
import type { FeedbackEntry } from '../types.js'
import { todayIso } from './config.js'
import { metricsPath } from './paths.js'

export interface SkillAggregate {
  name: string
  sessions: number
  success: number
  partial: number
  failed: number
  confidenceSum: number
}

export interface CommandAggregate {
  name: string
  invocations: number
  success: number
  partial: number
  failed: number
}

export interface MetricsReport {
  generatedAt: string
  periodLabel: string
  entries: FeedbackEntry[]
  skills: SkillAggregate[]
  commands: CommandAggregate[]
  totals: {
    sessions: number
    success: number
    partial: number
    failed: number
    avgConfidence: number | null
  }
}

export function buildMetricsReport(
  entries: FeedbackEntry[],
  opts: { periodLabel?: string; generatedAt?: string } = {},
): MetricsReport {
  const generatedAt = opts.generatedAt ?? todayIso()
  const periodLabel = opts.periodLabel ?? monthKeyFromEntries(entries) ?? generatedAt.slice(0, 7)

  const skillMap = new Map<string, SkillAggregate>()
  const commandMap = new Map<string, CommandAggregate>()

  let success = 0
  let partial = 0
  let failed = 0
  let confidenceSum = 0

  for (const e of entries) {
    if (e.outcome === 'success') success++
    else if (e.outcome === 'partial') partial++
    else failed++
    confidenceSum += e.confidence

    if (e.skill_used) {
      const s = skillMap.get(e.skill_used) ?? {
        name: e.skill_used,
        sessions: 0,
        success: 0,
        partial: 0,
        failed: 0,
        confidenceSum: 0,
      }
      s.sessions++
      s.confidenceSum += e.confidence
      if (e.outcome === 'success') s.success++
      else if (e.outcome === 'partial') s.partial++
      else s.failed++
      skillMap.set(e.skill_used, s)
    }

    if (e.command_used) {
      const c = commandMap.get(e.command_used) ?? {
        name: e.command_used,
        invocations: 0,
        success: 0,
        partial: 0,
        failed: 0,
      }
      c.invocations++
      if (e.outcome === 'success') c.success++
      else if (e.outcome === 'partial') c.partial++
      else c.failed++
      commandMap.set(e.command_used, c)
    }
  }

  const sessions = entries.length

  return {
    generatedAt,
    periodLabel,
    entries,
    skills: [...skillMap.values()].sort((a, b) => b.sessions - a.sessions),
    commands: [...commandMap.values()].sort((a, b) => b.invocations - a.invocations),
    totals: {
      sessions,
      success,
      partial,
      failed,
      avgConfidence: sessions > 0 ? Math.round((confidenceSum / sessions) * 10) / 10 : null,
    },
  }
}

function monthKeyFromEntries(entries: FeedbackEntry[]): string | null {
  if (entries.length === 0) return null
  const months = [...new Set(entries.map(e => e.date.slice(0, 7)))]
  if (months.length === 1) return months[0]!
  return `${months.sort()[0]} — ${months.sort().at(-1)}`
}

export function formatMetricsMarkdown(report: MetricsReport): string {
  const { periodLabel, generatedAt, skills, commands, totals } = report

  const skillRows =
    skills.length === 0
      ? '| _(nenhuma)_ | — | — | — | — | — |'
      : skills
          .map(s => {
            const avg =
              s.sessions > 0 ? (Math.round((s.confidenceSum / s.sessions) * 10) / 10).toFixed(1) : '—'
            return `| ${s.name} | ${s.sessions} | ${s.success} | ${s.partial} | ${s.failed} | ${avg} |`
          })
          .join('\n')

  const commandRows =
    commands.length === 0
      ? '| _(nenhum)_ | — | — | — | — |'
      : commands
          .map(c => `| ${c.name} | ${c.invocations} | ${c.success} | ${c.partial} | ${c.failed} |`)
          .join('\n')

  const summary =
    totals.sessions === 0
      ? '_Sem entradas em `feedback.md` para este período._'
      : `${totals.sessions} sessões | ${totals.success} success | ${totals.partial} partial | ${totals.failed} failed | confidence média ${totals.avgConfidence ?? '—'}`

  return `# Métricas de Assertividade

> Gerado por \`harness metrics --write\` em ${generatedAt}.
> Consolidação dos dados de \`evolution/feedback.md\`.

## Como interpretar

- **Confidence média** crescente → harness está evoluindo bem
- **Outcome \`failed\` recorrente** em uma skill → skill precisa de atualização
- **Command com \`partial\` frequente** → steps do command precisam de revisão

## Consolidado

### ${periodLabel}

**Resumo:** ${summary}

| Skill | Sessões | Success | Partial | Failed | Confidence média |
|-------|---------|---------|---------|--------|------------------|
${skillRows}

| Command | Invocações | Success | Partial | Failed |
|---------|-----------|---------|---------|--------|
${commandRows}
`
}

export async function writeMetricsFile(report: MetricsReport): Promise<void> {
  await writeFile(metricsPath(), formatMetricsMarkdown(report) + '\n', 'utf-8')
}

export function formatMetricsStdout(report: MetricsReport): string {
  const lines: string[] = [
    `📊 Métricas — ${report.periodLabel} (gerado ${report.generatedAt})`,
    '',
    report.totals.sessions === 0
      ? '   Nenhuma entrada de feedback no período.'
      : `   ${report.totals.sessions} sessões | success ${report.totals.success} | partial ${report.totals.partial} | failed ${report.totals.failed} | conf. média ${report.totals.avgConfidence ?? '—'}`,
  ]

  if (report.skills.length > 0) {
    lines.push('', '   Skills:')
    for (const s of report.skills) {
      const avg =
        s.sessions > 0 ? (Math.round((s.confidenceSum / s.sessions) * 10) / 10).toFixed(1) : '—'
      lines.push(
        `   • ${s.name}: ${s.sessions} sessões (${s.failed} failed) — conf. ${avg}`,
      )
    }
  }

  if (report.commands.length > 0) {
    lines.push('', '   Commands:')
    for (const c of report.commands) {
      lines.push(`   • ${c.name}: ${c.invocations} invocações (${c.failed} failed)`)
    }
  }

  return lines.join('\n')
}
