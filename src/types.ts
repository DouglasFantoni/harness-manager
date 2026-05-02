export interface ToolConfig {
  enabled: boolean
  slash_commands: boolean
  rules_format?: 'mdc'
  rules_folder?: string
  context_file?: string
  supports_mcp: boolean
  supports_bash?: boolean
  context_budget: 'small' | 'medium' | 'large'
  context_tokens_est: number
}

export interface HarnessConfig {
  version: string
  active_tools: string[]
  tools: Record<string, ToolConfig>
  context_strategy: {
    always_load: string[]
    load_on_demand: string[]
    never_load: string[]
  }
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

export interface SkillMeta {
  name: string
  domain: string
  weight: number
  exposes_command: string[]
  required_by: string[]
  load_with: string[]
  conflicts_with: string[]
}

export interface Registry {
  commands: CommandMeta[]
  skills: SkillMeta[]
}

export interface SyncFlags {
  dryRun: boolean
  forceContext: boolean
  only?: string
}

export interface AdapterResult {
  files: string[]
}
