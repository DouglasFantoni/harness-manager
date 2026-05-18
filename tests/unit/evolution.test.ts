import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TMP = resolve(tmpdir(), `harness-evolution-test-${Date.now()}`)

const baseConfig = {
  version: '1.0.0',
  tools: {
    cursor: {
      enabled: true,
      slash_commands: true,
      rules_format: 'mdc',
      rules_folder: '.cursor/rules/',
      supports_mcp: true,
      context_budget: 'medium',
      context_tokens_est: 8000,
    },
  },
  context_strategy: {
    always_load: ['core/rules.md'],
    load_on_demand: ['skills/'],
    never_load: ['evolution/'],
  },
  evolution: {
    metrics_interval_days: 7,
    proposals_interval_days: 14,
    last_metrics_at: null,
    last_proposals_review_at: null,
  },
}

const baseProject = {
  project: {
    name: 'evo-test',
    description: 'test',
    type: 'single',
    stack: { backend: [], frontend: [], infra: [] },
  },
  structure: { root: '.', apps: ['.'], packages: [], shared: [] },
  commands: {
    lint: 'pnpm lint',
    test: 'pnpm test',
    typecheck: 'pnpm typecheck',
    build: 'pnpm build',
    dev: 'pnpm dev',
    custom: {},
  },
  conventions: { branch_pattern: '', commit_pattern: '', pr_template: '' },
  context_hints: { entry_points: [], avoid_paths: [], critical_files: [] },
}

const sampleFeedback = `# Feedback

---

# Entradas

- date: 2026-05-10
  task: fix payroll bug
  skill_used: payroll
  command_used: /fix
  outcome: success
  confidence: 4

- date: 2026-05-12
  task: review module
  skill_used: nestjs
  command_used: /review
  outcome: partial
  confidence: 3
  notes: missing tests

- date: 2026-05-15
  task: failed deploy
  skill_used: payroll
  command_used: null
  outcome: failed
  confidence: 2
`

async function setupHarness(extra: { feedback?: string; config?: unknown; memory?: boolean } = {}) {
  const harnessDir = resolve(TMP, '.harness')
  await mkdir(resolve(harnessDir, 'evolution/proposed'), { recursive: true })
  await writeFile(resolve(harnessDir, 'harness.config.json'), JSON.stringify(extra.config ?? baseConfig))
  await writeFile(resolve(harnessDir, 'project-details.json'), JSON.stringify(baseProject))
  if (extra.feedback !== undefined) {
    await writeFile(resolve(harnessDir, 'evolution/feedback.md'), extra.feedback)
  }
  if (extra.memory !== false) {
    await mkdir(resolve(harnessDir, 'memory'), { recursive: true })
    await writeFile(
      resolve(harnessDir, 'memory/mistakes.md'),
      '# Mistakes\n\n---\n\n',
    )
    await writeFile(
      resolve(harnessDir, 'evolution/changelog.md'),
      '# Changelog\n\n---\n\n',
    )
  }
}

describe('evolution', () => {
  beforeEach(async () => {
    await mkdir(TMP, { recursive: true })
    vi.spyOn(process, 'cwd').mockReturnValue(TMP)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(TMP, { recursive: true, force: true })
  })

  describe('parseFeedbackFile', () => {
    it('parses YAML list entries after # Entradas', async () => {
      const { parseFeedbackFile } = await import('../../src/evolution/feedback.js')
      const entries = parseFeedbackFile(sampleFeedback)
      expect(entries).toHaveLength(3)
      expect(entries[0]?.skill_used).toBe('payroll')
      expect(entries[1]?.notes).toBe('missing tests')
      expect(entries[2]?.outcome).toBe('failed')
    })
  })

  describe('appendFeedbackEntry', () => {
    it('appends a new entry to feedback.md', async () => {
      await setupHarness({ feedback: sampleFeedback })
      const { appendFeedbackEntry, readFeedbackEntries } = await import('../../src/evolution/feedback.js')
      await appendFeedbackEntry({
        date: '2026-05-18',
        task: 'new entry',
        skill_used: null,
        command_used: null,
        outcome: 'success',
        confidence: 5,
      })
      const entries = await readFeedbackEntries()
      expect(entries).toHaveLength(4)
      expect(entries.at(-1)?.task).toBe('new entry')
    })
  })

  describe('buildMetricsReport', () => {
    it('aggregates by skill and command', async () => {
      const { parseFeedbackFile } = await import('../../src/evolution/feedback.js')
      const { buildMetricsReport } = await import('../../src/evolution/metrics.js')
      const entries = parseFeedbackFile(sampleFeedback)
      const report = buildMetricsReport(entries)
      expect(report.totals.sessions).toBe(3)
      expect(report.skills.find(s => s.name === 'payroll')?.failed).toBe(1)
      expect(report.commands.find(c => c.name === '/review')?.partial).toBe(1)
    })
  })

  describe('evolution config', () => {
    it('defaults intervals when evolution block is missing', async () => {
      const { resolveEvolutionConfig } = await import('../../src/evolution/config.js')
      const cfg = resolveEvolutionConfig({ version: '1', tools: {}, context_strategy: { always_load: [], load_on_demand: [], never_load: [] } })
      expect(cfg.metrics_interval_days).toBe(7)
      expect(cfg.proposals_interval_days).toBe(14)
    })

    it('detects stale metrics when never run', async () => {
      const { resolveEvolutionConfig, isMetricsStale } = await import('../../src/evolution/config.js')
      const evolution = resolveEvolutionConfig({
        version: '1',
        tools: {},
        context_strategy: { always_load: [], load_on_demand: [], never_load: [] },
        evolution: { metrics_interval_days: 7, proposals_interval_days: 14 },
      })
      expect(isMetricsStale(evolution)).toBe(true)
    })

    it('metrics not stale when updated recently', async () => {
      const { resolveEvolutionConfig, isMetricsStale, todayIso } = await import('../../src/evolution/config.js')
      const evolution = resolveEvolutionConfig({
        version: '1',
        tools: {},
        context_strategy: { always_load: [], load_on_demand: [], never_load: [] },
        evolution: {
          metrics_interval_days: 7,
          proposals_interval_days: 14,
          last_metrics_at: todayIso(),
        },
      })
      expect(isMetricsStale(evolution)).toBe(false)
    })

    it('rejects invalid interval in loadConfig', async () => {
      await setupHarness({
        config: {
          ...baseConfig,
          evolution: { metrics_interval_days: 0, proposals_interval_days: 14 },
        },
      })
      const { loadConfig } = await import('../../src/config.js')
      await expect(loadConfig()).rejects.toThrow('metrics_interval_days')
    })
  })

  describe('patchEvolutionTimestamps', () => {
    it('updates last_metrics_at in harness.config.json', async () => {
      await setupHarness({ feedback: sampleFeedback })
      const { patchEvolutionTimestamps } = await import('../../src/evolution/config.js')
      const { loadConfig } = await import('../../src/config.js')
      await patchEvolutionTimestamps({ last_metrics_at: '2026-05-18' })
      const { config } = await loadConfig()
      expect(config.evolution?.last_metrics_at).toBe('2026-05-18')
    })
  })

  describe('proposals', () => {
    it('rejects blocked targets', async () => {
      await setupHarness()
      const { assertTargetAllowed } = await import('../../src/evolution/proposal-rules.js')
      expect(() => assertTargetAllowed('harness.config.json')).toThrow('proibido')
      expect(() => assertTargetAllowed('core/rules.md')).toThrow('proibido')
    })

    it('creates, applies, and updates changelog', async () => {
      await setupHarness()
      const { createProposal } = await import('../../src/evolution/proposals.js')
      const { applyProposal } = await import('../../src/evolution/apply-proposal.js')
      const { readFile } = await import('fs/promises')

      const proposal = await createProposal({
        target: 'memory/mistakes.md',
        title: 'INSS flat rate',
        body: '## [2026-05] INSS\n**Problema**: flat rate used',
        created: '2026-05-18',
      })

      expect(proposal.meta.status).toBe('pending')

      const applied = await applyProposal(proposal)
      expect(applied.meta.status).toBe('applied')

      const mistakes = await readFile(resolve(TMP, '.harness/memory/mistakes.md'), 'utf-8')
      expect(mistakes).toContain('INSS flat rate')

      const changelog = await readFile(resolve(TMP, '.harness/evolution/changelog.md'), 'utf-8')
      expect(changelog).toContain('INSS flat rate')
    })

    it('rejects a pending proposal', async () => {
      await setupHarness()
      const { createProposal } = await import('../../src/evolution/proposals.js')
      const { rejectProposal } = await import('../../src/evolution/apply-proposal.js')

      const proposal = await createProposal({
        target: 'memory/mistakes.md',
        title: 'Discard me',
        body: 'should not apply',
        created: '2026-05-18',
      })

      const rejected = await rejectProposal(proposal, 'not needed')
      expect(rejected.meta.status).toBe('rejected')
      expect(rejected.meta.reject_reason).toBe('not needed')
    })

    it('listPendingProposals only returns pending', async () => {
      await setupHarness()
      const { createProposal } = await import('../../src/evolution/proposals.js')
      const { applyProposal } = await import('../../src/evolution/apply-proposal.js')
      const { listPendingProposals } = await import('../../src/evolution/proposals.js')

      const p1 = await createProposal({
        target: 'memory/mistakes.md',
        title: 'One',
        body: 'a',
        created: '2026-05-18',
      })
      await createProposal({
        target: 'memory/mistakes.md',
        title: 'Two',
        body: 'b',
        created: '2026-05-18',
      })

      await applyProposal(p1)
      const pending = await listPendingProposals()
      expect(pending).toHaveLength(1)
      expect(pending[0]?.id).toContain('two')
    })
  })
})
