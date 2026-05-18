import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type { HarnessConfig, RegistryConfig, RegistryScopeConfig } from './types.js'

export const DEFAULT_SKILLS_BASE_URL =
  'https://raw.githubusercontent.com/DouglasFantoni/harness-manager/main/registry/skills'

export const DEFAULT_RULES_BASE_URL =
  'https://raw.githubusercontent.com/DouglasFantoni/harness-manager/main/registry/rules'

export type { RegistryConfig, RegistryScopeConfig }

export interface PackageRef {
  scope: string | null
  name: string
  raw: string
}

export type SemverCompareKind = 'same' | 'patch' | 'minor' | 'major' | 'unknown'

export interface SemverCompareResult {
  kind: SemverCompareKind
  breaking: boolean
}

function harnessRoot() {
  return resolve(process.cwd(), '.harness')
}

/** Load registry URLs from harness.config.json (with defaults). */
export async function loadRegistryConfig(): Promise<RegistryConfig> {
  try {
    const raw = await readFile(resolve(harnessRoot(), 'harness.config.json'), 'utf-8')
    const config = JSON.parse(raw) as HarnessConfig
    return mergeRegistryDefaults(config.registry)
  } catch {
    return mergeRegistryDefaults(undefined)
  }
}

export function mergeRegistryDefaults(partial?: Partial<RegistryConfig>): RegistryConfig {
  return {
    skills_base_url: partial?.skills_base_url ?? DEFAULT_SKILLS_BASE_URL,
    rules_base_url: partial?.rules_base_url ?? DEFAULT_RULES_BASE_URL,
    manifest_url: partial?.manifest_url,
    scopes: partial?.scopes ?? {},
  }
}

/**
 * Package reference:
 * - `nestjs` → official registry
 * - `@myorg/payroll` → scope registry from harness.config.json
 * - `https://.../SKILL.md` → direct URL
 */
export function parsePackageRef(input: string): PackageRef {
  const raw = input.trim()
  if (isAbsoluteUrl(raw)) {
    return { scope: null, name: localNameFromUrl(raw), raw }
  }

  if (raw.startsWith('@')) {
    const slash = raw.indexOf('/')
    if (slash <= 1 || slash === raw.length - 1) {
      throw new Error(
        `Referência inválida "${raw}". Use @escopo/nome (ex.: @myorg/payroll).`,
      )
    }
    return {
      scope: raw.slice(1, slash),
      name: raw.slice(slash + 1),
      raw,
    }
  }

  return { scope: null, name: raw, raw }
}

/** Local install directory name (avoids collisions between scopes). */
export function localInstallName(ref: PackageRef): string {
  if (ref.scope) return `${ref.scope}-${ref.name}`
  return ref.name
}

export function resolveSkillUrl(packageRef: string, config: RegistryConfig): string {
  const ref = parsePackageRef(packageRef)
  if (isAbsoluteUrl(ref.raw)) return ref.raw

  const base = resolveSkillsBase(ref, config)
  return joinUrl(base, `${ref.name}/SKILL.md`)
}

export function resolveRulePackUrl(packageRef: string, config: RegistryConfig): string {
  const ref = parsePackageRef(packageRef)
  if (isAbsoluteUrl(ref.raw)) return ref.raw

  const base = resolveRulesBase(ref, config)
  return joinUrl(base, `${ref.name}.md`)
}

/** Optional CHANGELOG next to skill (same folder as SKILL.md). */
export function resolveSkillChangelogUrl(skillSourceUrl: string): string {
  if (!skillSourceUrl.endsWith('/SKILL.md')) return ''
  return skillSourceUrl.replace(/\/SKILL\.md$/, '/CHANGELOG.md')
}

export function resolveRuleChangelogUrl(ruleSourceUrl: string): string {
  if (!ruleSourceUrl.endsWith('.md')) return ''
  return ruleSourceUrl.replace(/\.md$/, '') + '.CHANGELOG.md'
}

function resolveSkillsBase(ref: PackageRef, config: RegistryConfig): string {
  if (!ref.scope) return normalizeBase(config.skills_base_url)
  const scope = config.scopes?.[ref.scope]
  if (!scope?.skills_base_url) {
    throw new Error(
      `Scope "@${ref.scope}" não configurado em harness.config.json → registry.scopes.${ref.scope}.skills_base_url`,
    )
  }
  return normalizeBase(scope.skills_base_url)
}

function resolveRulesBase(ref: PackageRef, config: RegistryConfig): string {
  if (!ref.scope) return normalizeBase(config.rules_base_url)
  const scope = config.scopes?.[ref.scope]
  if (!scope?.rules_base_url) {
    throw new Error(
      `Scope "@${ref.scope}" não configurado em harness.config.json → registry.scopes.${ref.scope}.rules_base_url`,
    )
  }
  return normalizeBase(scope.rules_base_url)
}

export function compareSemver(
  local: string | null | undefined,
  remote: string | null | undefined,
): SemverCompareResult {
  if (!local || !remote) return { kind: 'unknown', breaking: false }
  if (local === remote) return { kind: 'same', breaking: false as const }

  const l = parseSemver(local)
  const r = parseSemver(remote)
  if (!l || !r) return { kind: 'unknown', breaking: false }

  if (r.major > l.major) return { kind: 'major', breaking: true }
  if (r.major === l.major && r.minor > l.minor) return { kind: 'minor', breaking: false }
  if (r.major === l.major && r.minor === l.minor && r.patch > l.patch) {
    return { kind: 'patch', breaking: false }
  }
  return { kind: 'unknown', breaking: false }
}

export function formatSemverWarning(
  packageName: string,
  from: string | undefined,
  to: string | undefined,
  cmp: SemverCompareResult,
): string | null {
  if (cmp.kind !== 'major' || !from || !to) return null
  return (
    `⚠️  ${packageName}: atualização MAJOR (${from} → ${to}) — pode conter breaking changes. ` +
    `Veja CHANGELOG na registry e registry/VERSIONING.md.`
  )
}

export async function fetchRegistryText(
  url: string,
  options?: { tokenEnv?: string },
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: 'text/plain, text/markdown, application/json, */*',
  }

  const token =
    (options?.tokenEnv && process.env[options.tokenEnv]) ||
    process.env.HARNESS_REGISTRY_TOKEN ||
    process.env.GITHUB_TOKEN

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const hint =
      res.status === 401 || res.status === 403
        ? ' — para registry privada, defina GITHUB_TOKEN ou HARNESS_REGISTRY_TOKEN'
        : ''
    throw new Error(`HTTP ${res.status} — ${url}${hint}`)
  }
  return res.text()
}

/** Token env for scoped registry (falls back to global env vars). */
export function scopeTokenEnv(ref: PackageRef, config: RegistryConfig): string | undefined {
  if (!ref.scope) return undefined
  return config.scopes?.[ref.scope]?.token_env
}

function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) return null
  return { major: +m[1], minor: +m[2], patch: +m[3] }
}

function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

function normalizeBase(base: string): string {
  return base.replace(/\/+$/, '')
}

function joinUrl(base: string, path: string): string {
  return `${normalizeBase(base)}/${path.replace(/^\/+/, '')}`
}

function localNameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    const skillIdx = parts.lastIndexOf('SKILL.md')
    if (skillIdx > 0) return parts[skillIdx - 1]!
    const file = parts[parts.length - 1]
    if (file?.endsWith('.md')) return file.replace(/\.md$/, '')
    return parts[parts.length - 1] ?? 'custom'
  } catch {
    return 'custom'
  }
}
