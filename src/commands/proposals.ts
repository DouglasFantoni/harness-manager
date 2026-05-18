import { readFile } from 'fs/promises'
import { createInterface } from 'readline'
import { applyProposal, rejectProposal } from '../evolution/apply-proposal.js'
import { normalizeTarget } from '../evolution/proposal-rules.js'
import { assertTargetFileExists, createProposal, findProposalById, listAllProposals } from '../evolution/proposals.js'
import { runSync } from '../sync.js'
import type { ProposalStatus, ProposalType } from '../types.js'

function parseFlag(args: string[], flag: string): string | undefined {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith(`${flag}=`)) return args[i].split('=').slice(1).join('=')
    if (args[i] === flag && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1]
  }
  return undefined
}

export async function runProposals(args: string[]): Promise<void> {
  const sub = args[0]

  if (!sub || sub === '--help' || sub === '-h') {
    printUsage()
    return
  }

  if (sub === 'propose') {
    await runPropose(args.slice(1))
    return
  }

  if (sub === 'list') {
    await runList(args.slice(1))
    return
  }

  if (sub === 'show') {
    await runShow(args.slice(1))
    return
  }

  if (sub === 'apply') {
    await runApply(args.slice(1))
    return
  }

  if (sub === 'reject') {
    await runReject(args.slice(1))
    return
  }

  console.error(`❌ Subcomando desconhecido: "${sub}"`)
  printUsage()
  process.exit(1)
}

async function runPropose(args: string[]): Promise<void> {
  const target = parseFlag(args, '--target')
  const title = parseFlag(args, '--title')
  const type = parseFlag(args, '--type')
  const bodyFlag = parseFlag(args, '--body')
  const bodyFile = parseFlag(args, '--body-file')
  const sourceFeedback = parseFlag(args, '--source-feedback')
  const useStdin = args.includes('--stdin')

  if (!target?.trim()) throw new Error('--target é obrigatório')
  if (!title?.trim()) throw new Error('--title é obrigatório')

  let body = bodyFlag ?? ''
  if (bodyFile) {
    body = await readFile(bodyFile, 'utf-8')
  } else if (useStdin) {
    body = await readStdin()
  }
  if (!body.trim()) {
    throw new Error('corpo obrigatório: --body, --body-file ou --stdin')
  }

  const normalizedTarget = normalizeTarget(target)
  await assertTargetFileExists(normalizedTarget)

  const proposal = await createProposal({
    target: normalizedTarget,
    title: title.trim(),
    body: body.trim(),
    type: type as ProposalType | undefined,
    source_feedback: sourceFeedback,
  })

  console.log(`✅ Proposta criada: ${proposal.meta.id}`)
  console.log(`   target: .harness/${proposal.meta.target}`)
  console.log(`   file:   .harness/evolution/proposed/${proposal.filename}`)
  console.log(`\n   Revise com: harness proposals show ${proposal.meta.id}`)
  console.log(`   Aplique com: harness proposals apply ${proposal.meta.id}`)
}

async function runList(args: string[]): Promise<void> {
  const json = args.includes('--json')
  const status = (parseFlag(args, '--status') ?? 'pending') as ProposalStatus | 'all'

  const all = await listAllProposals()
  const filtered = status === 'all' ? all : all.filter(p => p.meta.status === status)

  if (json) {
    console.log(JSON.stringify(filtered.map(p => p.meta), null, 2))
    return
  }

  if (filtered.length === 0) {
    console.log(`ℹ️  Nenhuma proposta com status "${status}".`)
    return
  }

  console.log(`📋 Proposals (${filtered.length})\n`)
  for (const p of filtered) {
    console.log(
      `  • [${p.meta.status}] ${p.meta.id}\n    ${p.meta.title} → .harness/${p.meta.target} (${p.meta.created})`,
    )
  }
}

async function runShow(args: string[]): Promise<void> {
  const id = args.find(a => !a.startsWith('--'))
  if (!id) throw new Error('usage: harness proposals show <id>')

  const proposal = await findProposalById(id)
  if (!proposal) {
    throw new Error(`proposta não encontrada: ${id}`)
  }

  console.log(`\n# ${proposal.meta.title}\n`)
  console.log(`id:      ${proposal.meta.id}`)
  console.log(`status:  ${proposal.meta.status}`)
  console.log(`target:  .harness/${proposal.meta.target}`)
  console.log(`type:    ${proposal.meta.type}`)
  console.log(`created: ${proposal.meta.created}`)
  if (proposal.meta.source_feedback) {
    console.log(`source:  ${proposal.meta.source_feedback}`)
  }
  console.log(`\n--- body (will be appended) ---\n`)
  console.log(proposal.body || '_(empty)_')
  console.log('')
}

async function runApply(args: string[]): Promise<void> {
  const yes = args.includes('--yes')
  const noSync = args.includes('--no-sync')
  const id = args.find(a => !a.startsWith('--'))
  if (!id) throw new Error('usage: harness proposals apply <id> [--yes] [--no-sync]')

  const proposal = await findProposalById(id)
  if (!proposal) throw new Error(`proposta não encontrada: ${id}`)

  console.log(`\nApply proposal: ${proposal.meta.title}`)
  console.log(`  → .harness/${proposal.meta.target}\n`)
  console.log(proposal.body)
  console.log('')

  if (!yes) {
    const ok = await confirm('Aplicar esta proposta? (y/N) ')
    if (!ok) {
      console.log('Cancelado.')
      return
    }
  }

  const applied = await applyProposal(proposal)
  console.log(`\n✅ Aplicado — status: ${applied.meta.status}`)
  console.log(`   Changelog atualizado em evolution/changelog.md`)

  if (!noSync) {
    console.log('\n🔄 Rodando harness sync...\n')
    await runSync({ dryRun: false, forceContext: false })
  } else {
    console.log('\nℹ️  Rode `harness sync` para regenerar adapters.')
  }
}

async function runReject(args: string[]): Promise<void> {
  const reason = parseFlag(args, '--reason')
  const id = args.find(a => !a.startsWith('--'))
  if (!id) throw new Error('usage: harness proposals reject <id> [--reason "..."]')

  const proposal = await findProposalById(id)
  if (!proposal) throw new Error(`proposta não encontrada: ${id}`)

  const rejected = await rejectProposal(proposal, reason)
  console.log(`✅ Proposta rejeitada: ${rejected.meta.id}`)
  if (reason) console.log(`   Motivo: ${reason}`)
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new Error('modo não interativo: use --yes para aplicar')
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>(resolve => {
    rl.question(question, resolve)
  })
  rl.close()
  return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes'
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function printUsage(): void {
  console.log(`
  harness proposals — supervised harness changes

    harness proposals propose --target memory/mistakes.md --title "..." --body "..."
      --type memory          optional (inferred from target)
      --body-file <path>     markdown body to append
      --stdin                read body from stdin
      --source-feedback id   optional trace

    harness proposals list [--status pending|applied|rejected|all] [--json]
    harness proposals show <id>
    harness proposals apply <id> [--yes] [--no-sync]
    harness proposals reject <id> [--reason "..."]
`)
}
