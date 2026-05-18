export interface ToolConfig {
  enabled: boolean
  slash_commands: boolean
  rules_format?: 'mdc'
  rules_folder?: string
  /** Cursor: subtree (relative to project root) wiped and rewritten with mirrored Agent Skills. */
  agent_skills_mirror_root?: string
  /** Copilot: compact skills/hooks mirror (default `.github/harness`). */
  copilot_mirror_root?: string
  context_file?: string
  supports_mcp: boolean
  supports_bash?: boolean
  context_budget: 'small' | 'medium' | 'large'
  context_tokens_est: number
}

/** Evolution loop: feedback intervals and last-run timestamps (ISO date YYYY-MM-DD). */
export interface EvolutionConfig {
  /** Regenerate `evolution/metrics.md` when this many days passed since `last_metrics_at`. */
  metrics_interval_days: number
  /** Review pending `evolution/proposed/` when this many days passed since `last_proposals_review_at`. */
  proposals_interval_days: number
  last_metrics_at?: string | null
  last_proposals_review_at?: string | null
}

/** Per-scope registry (private org repos, custom GitHub raw bases). */
export interface RegistryScopeConfig {
  skills_base_url?: string
  rules_base_url?: string
  /** Env var name holding a bearer token for private raw URLs (e.g. GITHUB_TOKEN). */
  token_env?: string
}

/** Remote registry — overrides bundled npm paths for skill-add / rule-add / sync. */
export interface RegistryConfig {
  skills_base_url: string
  rules_base_url: string
  /** Optional JSON manifest listing available packages (future: harness registry list). */
  manifest_url?: string
  scopes?: Record<string, RegistryScopeConfig>
}

export interface HarnessConfig {
  version: string
  tools: Record<string, ToolConfig>
  context_strategy: {
    always_load: string[]
    load_on_demand: string[]
    never_load: string[]
  }
  evolution?: EvolutionConfig
  registry?: RegistryConfig
}

export type FeedbackOutcome = 'success' | 'partial' | 'failed'

export type ProposalStatus = 'pending' | 'applied' | 'rejected'

export type ProposalType =
  | 'memory'
  | 'skill-update'
  | 'skill-new'
  | 'glossary'
  | 'command'
  | 'hook'
  | 'other'

export interface ProposalMeta {
  id: string
  status: ProposalStatus
  target: string
  type: ProposalType
  title: string
  created: string
  source_feedback?: string | null
  applied_at?: string | null
  rejected_at?: string | null
  reject_reason?: string | null
}

export interface Proposal {
  meta: ProposalMeta
  body: string
  filename: string
  path: string
}

export interface FeedbackEntry {
  date: string
  task: string
  skill_used: string | null
  command_used: string | null
  outcome: FeedbackOutcome
  confidence: number
  notes?: string
}

export interface ProjectStack {
  backend: string[]
  frontend: string[]
  infra: string[]
}

export interface ProjectDetails {
  project: {
    name: string
    description: string
    type: 'monorepo' | 'single'
    stack: ProjectStack
  }
  structure: {
    root: string
    apps: string[]
    packages: string[]
    shared: string[]
  }
  commands: {
    lint: string
    test: string
    typecheck: string
    build: string
    dev: string
    custom: Record<string, string>
  }
  // Scripts do package.json do projeto (injetado pelo prompt command)
  scripts?: Record<string, string>
  conventions: {
    branch_pattern: string
    commit_pattern: string
    pr_template: string
  }
  context_hints: {
    entry_points: string[]
    avoid_paths: string[]
    critical_files: string[]
  }
}

export interface CommandMeta {
  name: string
  file: string
  description: string
  supported_by: string[]
  requires: string[]
  globs: string[]
}

// Mapeamento glob → skill para lazy loading
export interface SkillGlobMapping {
  glob: string        // ex: "**/*.service.ts", "apps/api/**"
  skill: string       // nome da skill no _index.md
  description: string // exibido no .mdc gerado
}

export interface SkillMeta {
  name: string
  domain: string
  weight: number
  description?: string
  exposes_command: string[]
  required_by: string[]
  load_with: string[]
  conflicts_with: string[]
  globs: string[]
  source: string | null
  sync: boolean
}

export interface HookMeta {
  name: string
  file: string
  triggers: string
  blocks: boolean
  weight: number
  always_load: boolean
}

export interface Registry {
  commands: CommandMeta[]
  skills: SkillMeta[]
  hooks: HookMeta[]
  skillGlobs: SkillGlobMapping[]
}

export interface SyncFlags {
  dryRun: boolean
  forceContext: boolean
  only?: string
  watch?: boolean
}

export interface AdapterResult {
  files: string[]
}
