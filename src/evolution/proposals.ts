import { access, mkdir, readFile, readdir, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { resolve } from 'path'
import type { Proposal, ProposalMeta, ProposalStatus, ProposalType } from '../types.js'
import { todayIso } from './config.js'
import { proposedDir } from './paths.js'
import {
    assertTargetAllowed,
    inferProposalType,
    normalizeTarget,
    slugifyTitle,
    targetAbsolutePath,
} from './proposal-rules.js'

export interface ProposalFile {
  id: string
  filename: string
  path: string
}

const VALID_STATUS: ProposalStatus[] = ['pending', 'applied', 'rejected']
const VALID_TYPES: ProposalType[] = [
  'memory',
  'skill-update',
  'skill-new',
  'glossary',
  'command',
  'hook',
  'other',
]

export function parseProposalContent(
  raw: string,
  filename: string,
  filePath: string,
): Proposal {
  const { data, content } = matter(raw)
  const meta = validateProposalMeta(data, filename)
  return {
    meta,
    body: content.trim(),
    filename,
    path: filePath,
  }
}

function validateProposalMeta(data: Record<string, unknown>, filename: string): ProposalMeta {
  const id = (data.id as string) ?? filename.replace(/\.md$/, '')
  const status = data.status as ProposalStatus
  const target = data.target as string
  const type = data.type as ProposalType
  const title = data.title as string
  const created = data.created as string

  if (!status || !VALID_STATUS.includes(status)) {
    throw new Error(`${filename}: status inválido (pending | applied | rejected)`)
  }
  if (!target?.trim()) throw new Error(`${filename}: target é obrigatório`)
  if (!type || !VALID_TYPES.includes(type)) {
    throw new Error(`${filename}: type inválido`)
  }
  if (!title?.trim()) throw new Error(`${filename}: title é obrigatório`)
  if (!created || !/^\d{4}-\d{2}-\d{2}$/.test(created)) {
    throw new Error(`${filename}: created deve ser YYYY-MM-DD`)
  }

  assertTargetAllowed(target)

  return {
    id,
    status,
    target: normalizeTarget(target),
    type,
    title: title.trim(),
    created,
    source_feedback: (data.source_feedback as string | null) ?? null,
    applied_at: (data.applied_at as string | null) ?? null,
    rejected_at: (data.rejected_at as string | null) ?? null,
    reject_reason: (data.reject_reason as string | null) ?? null,
  }
}

export async function readProposalFile(filePath: string): Promise<Proposal> {
  const raw = await readFile(filePath, 'utf-8')
  const filename = filePath.split('/').pop() ?? 'proposal.md'
  return parseProposalContent(raw, filename, filePath)
}

export async function listAllProposals(): Promise<Proposal[]> {
  let names: string[]
  try {
    names = await readdir(proposedDir())
  } catch {
    return []
  }

  const proposals: Proposal[] = []
  for (const filename of names.filter(n => n.endsWith('.md') && !n.startsWith('_'))) {
    const path = resolve(proposedDir(), filename)
    try {
      proposals.push(await readProposalFile(path))
    } catch (err) {
      console.warn(`⚠️  Ignorando ${filename}: ${(err as Error).message}`)
    }
  }

  return proposals.sort((a, b) => b.meta.created.localeCompare(a.meta.created))
}

export async function listPendingProposals(): Promise<ProposalFile[]> {
  const all = await listAllProposals()
  return all
    .filter(p => p.meta.status === 'pending')
    .map(p => ({
      id: p.meta.id,
      filename: p.filename,
      path: p.path,
    }))
}

export async function findProposalById(id: string): Promise<Proposal | null> {
  const all = await listAllProposals()
  return all.find(p => p.meta.id === id || p.filename === id || p.filename === `${id}.md`) ?? null
}

export interface CreateProposalInput {
  target: string
  type?: ProposalType
  title: string
  body: string
  source_feedback?: string
  created?: string
}

export async function createProposal(input: CreateProposalInput): Promise<Proposal> {
  const target = normalizeTarget(input.target)
  assertTargetAllowed(target)
  const type = input.type ?? inferProposalType(target)
  const created = input.created ?? todayIso()
  const slug = slugifyTitle(input.title)
  const baseName = `${created}-${slug}`
  await mkdir(proposedDir(), { recursive: true })

  let filename = `${baseName}.md`
  let n = 1
  while (await fileExists(resolve(proposedDir(), filename))) {
    filename = `${baseName}-${n}.md`
    n++
  }

  const meta: ProposalMeta = {
    id: filename.replace(/\.md$/, ''),
    status: 'pending',
    target,
    type,
    title: input.title.trim(),
    created,
    source_feedback: input.source_feedback ?? null,
    applied_at: null,
    rejected_at: null,
    reject_reason: null,
  }

  const path = resolve(proposedDir(), filename)
  await writeFile(path, formatProposalFile(meta, input.body.trim()), 'utf-8')
  return readProposalFile(path)
}

export function formatProposalFile(meta: ProposalMeta, body: string): string {
  const fm: Record<string, unknown> = {
    id: meta.id,
    status: meta.status,
    target: meta.target,
    type: meta.type,
    title: meta.title,
    created: meta.created,
  }
  if (meta.source_feedback) fm.source_feedback = meta.source_feedback
  if (meta.applied_at) fm.applied_at = meta.applied_at
  if (meta.rejected_at) fm.rejected_at = meta.rejected_at
  if (meta.reject_reason) fm.reject_reason = meta.reject_reason

  return matter.stringify(body.trim() ? '\n' + body.trim() + '\n' : '\n', fm)
}

export async function updateProposalStatus(
  proposal: Proposal,
  patch: Partial<Pick<ProposalMeta, 'status' | 'applied_at' | 'rejected_at' | 'reject_reason'>>,
): Promise<Proposal> {
  const meta: ProposalMeta = { ...proposal.meta, ...patch }
  await writeFile(proposal.path, formatProposalFile(meta, proposal.body), 'utf-8')
  return readProposalFile(proposal.path)
}

export async function assertTargetFileExists(target: string): Promise<void> {
  const abs = targetAbsolutePath(target)
  if (!(await fileExists(abs))) {
    throw new Error(`arquivo alvo não existe: .harness/${normalizeTarget(target)}`)
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
