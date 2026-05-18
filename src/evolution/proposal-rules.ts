import { resolve } from 'path'
import type { ProposalType } from '../types.js'
import { getHarnessRoot } from './paths.js'

const BLOCKED_EXACT = new Set([
  'harness.config.json',
  'project-details.json',
  'core/rules.md',
])

const BLOCKED_PREFIXES = ['adapters/', 'evolution/proposed/', 'evolution/feedback.md', 'evolution/metrics.md']

const ALLOWED_PREFIXES = ['memory/', 'skills/', 'core/glossary.md', 'commands/', 'hooks/']

export function normalizeTarget(target: string): string {
  let t = target.trim().replace(/^\.harness\//, '')
  if (t.startsWith('/')) {
    throw new Error('target deve ser relativo a .harness/ (sem / inicial)')
  }
  if (t.includes('..')) {
    throw new Error('target não pode conter ".."')
  }
  return t
}

export function assertTargetAllowed(target: string): void {
  const t = normalizeTarget(target)

  if (BLOCKED_EXACT.has(t)) {
    throw new Error(`target proibido: ${t} (alteração humana apenas)`)
  }

  for (const prefix of BLOCKED_PREFIXES) {
    if (t === prefix.replace(/\/$/, '') || t.startsWith(prefix)) {
      throw new Error(`target proibido: ${t}`)
    }
  }

  const allowed =
    ALLOWED_PREFIXES.some(p => t === p || t.startsWith(p)) ||
    t === 'core/glossary.md'

  if (!allowed) {
    throw new Error(
      `target não permitido: ${t}. Permitidos: ${ALLOWED_PREFIXES.join(', ')}`,
    )
  }
}

export function inferProposalType(target: string): ProposalType {
  const t = normalizeTarget(target)
  if (t.startsWith('memory/')) return 'memory'
  if (t.startsWith('skills/')) return 'skill-update'
  if (t === 'core/glossary.md') return 'glossary'
  if (t.startsWith('commands/')) return 'command'
  if (t.startsWith('hooks/')) return 'hook'
  return 'other'
}

export function targetAbsolutePath(target: string): string {
  return resolve(getHarnessRoot(), normalizeTarget(target))
}

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'change'
}
