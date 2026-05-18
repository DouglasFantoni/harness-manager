import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import type { Proposal } from '../types.js'
import { todayIso } from './config.js'
import { getHarnessRoot } from './paths.js'
import { targetAbsolutePath } from './proposal-rules.js'
import { updateProposalStatus } from './proposals.js'

export async function appendToChangelog(proposal: Proposal): Promise<void> {
  const changelogPath = resolve(getHarnessRoot(), 'evolution/changelog.md')
  const entry = `
## ${todayIso()} — ${proposal.meta.title}
**Tipo**: ${proposal.meta.type}
**Arquivo**: \`.harness/${proposal.meta.target}\`
**Mudança**: Aplicado via \`harness proposals apply ${proposal.meta.id}\`.
**Aprovado por**: humano
`
  let content: string
  try {
    content = await readFile(changelogPath, 'utf-8')
  } catch {
    content = '# Changelog do Harness\n\n'
  }
  await writeFile(changelogPath, content.trimEnd() + '\n' + entry + '\n', 'utf-8')
}

export async function applyProposalContent(proposal: Proposal): Promise<void> {
  if (proposal.meta.status !== 'pending') {
    throw new Error(`proposta "${proposal.meta.id}" não está pending (status: ${proposal.meta.status})`)
  }
  if (!proposal.body.trim()) {
    throw new Error('proposta sem conteúdo no corpo (markdown após o frontmatter)')
  }

  const targetPath = targetAbsolutePath(proposal.meta.target)
  let existing: string
  try {
    existing = await readFile(targetPath, 'utf-8')
  } catch {
    throw new Error(`arquivo alvo não encontrado: .harness/${proposal.meta.target}`)
  }

  const separator = existing.endsWith('\n') ? '\n' : '\n\n'
  await writeFile(targetPath, existing.trimEnd() + separator + proposal.body.trim() + '\n', 'utf-8')
}

export async function applyProposal(
  proposal: Proposal,
): Promise<Proposal> {
  await applyProposalContent(proposal)
  await appendToChangelog(proposal)
  return updateProposalStatus(proposal, {
    status: 'applied',
    applied_at: todayIso(),
  })
}

export async function rejectProposal(
  proposal: Proposal,
  reason?: string,
): Promise<Proposal> {
  if (proposal.meta.status !== 'pending') {
    throw new Error(`proposta "${proposal.meta.id}" não está pending`)
  }
  return updateProposalStatus(proposal, {
    status: 'rejected',
    rejected_at: todayIso(),
    reject_reason: reason?.trim() || null,
  })
}
