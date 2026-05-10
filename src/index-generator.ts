import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import type { SkillMeta, CommandMeta, HookMeta } from './types.js'

function harnessRoot() { return resolve(process.cwd(), '.harness') }

/**
 * Gera os _index.md legíveis pela IA a partir dos JSONs de fonte de verdade.
 * Chamado pelo sync após carregar o registry.
 */
export async function generateIndexFiles(
  skills: SkillMeta[],
  commands: CommandMeta[],
  hooks: HookMeta[],
  dryRun = false,
): Promise<string[]> {
  const generated: string[] = []

  const writes = await Promise.all([
    generateSkillsIndex(skills, dryRun),
    generateCommandsIndex(commands, dryRun),
    generateHooksIndex(hooks, dryRun),
  ])

  for (const path of writes) {
    if (path) generated.push(path)
  }

  return generated
}

// ─── Skills _index.md ─────────────────────────────────────────────────────────

async function generateSkillsIndex(skills: SkillMeta[], dryRun: boolean): Promise<string | null> {
  const rows = skills.map(s => {
    const exposes = s.exposes_command.length ? s.exposes_command.join(', ') : '—'
    const required = s.required_by.length ? s.required_by.join(', ') : '—'
    const syncBadge = s.source ? '🔄' : '📁'
    return `| ${syncBadge} \`${s.name}\` | ${s.domain} | ~${s.weight} | ${exposes} | ${required} |`
  })

  const content = `# Skills Registry

> ⚠️ Gerado automaticamente pelo \`harness sync\` — não edite manualmente.
> Fonte de verdade: \`skills/index.json\`

| Skill | Domínio | Peso ~ | Expõe Command | Carregada por |
|-------|---------|--------|---------------|---------------|
${rows.join('\n')}

## Legenda

- 🔄 Skill da registry oficial (sincronizável via \`harness skill-sync\`)
- 📁 Skill local do projeto

## Regra de carregamento

A IA deve:
1. Identificar o domínio do arquivo ou task atual
2. Carregar apenas a skill correspondente
3. Verificar se \`load_with\` sugere skill complementar
4. Garantir que a soma dos pesos não ultrapasse **40% do \`context_tokens_est\`** da tool ativa
`

  return writeIfChanged(resolve(harnessRoot(), 'skills/_index.md'), content, dryRun)
}

// ─── Commands _index.md ───────────────────────────────────────────────────────

async function generateCommandsIndex(commands: CommandMeta[], dryRun: boolean): Promise<string | null> {
  const rows = commands.map(cmd => {
    const cursor  = cmd.supported_by.includes('cursor')      ? '✅' : '❌'
    const claude  = cmd.supported_by.includes('claude-code') ? '✅' : '❌'
    const copilot = cmd.supported_by.includes('copilot')     ? '✅' : '❌'
    return `| \`${cmd.name}\` | ${cmd.description} | ${cursor} | ${claude} | ${copilot} | \`${cmd.file}\` |`
  })

  const content = `# Commands Registry

> ⚠️ Gerado automaticamente pelo \`harness sync\` — não edite manualmente.
> Fonte de verdade: \`commands/index.json\`

| Comando | Descrição | Cursor | Claude Code | Copilot | Arquivo |
|---------|-----------|--------|-------------|---------|---------|
${rows.join('\n')}

## Regra do sync

Apenas commands com ✅ para a tool ativa são gerados no adapter correspondente.
Commands com ❌ são ignorados silenciosamente para aquela tool.
`

  return writeIfChanged(resolve(harnessRoot(), 'commands/_index.md'), content, dryRun)
}

// ─── Hooks _index.md ──────────────────────────────────────────────────────────

async function generateHooksIndex(hooks: HookMeta[], dryRun: boolean): Promise<string | null> {
  const rows = hooks.map(h => {
    const blocks = h.blocks ? '✅ Sim' : '❌ Não'
    return `| \`${h.name}\` | ${h.triggers} | ${blocks} | ~${h.weight} |`
  })

  const alwaysLoad = hooks.filter(h => h.always_load).map(h => `\`${h.name}\``).join(', ')

  const content = `# Hooks Registry

> ⚠️ Gerado automaticamente pelo \`harness sync\` — não edite manualmente.
> Fonte de verdade: \`hooks/index.json\`

| Hook | Dispara quando | Bloqueia execução? | Peso ~ |
|------|---------------|-------------------|--------|
${rows.join('\n')}

## Regras de carregamento

- Always load: ${alwaysLoad}
- Os demais são \`load_on_demand\` — carregados apenas quando o momento chega
- A soma de todos os hooks ativos nunca deve ultrapassar 20% do \`context_tokens_est\`

## Sequência garantida para slash commands

\`\`\`
on-command → on-skill-load → pre-task → EXECUÇÃO → post-task
                                  ↑
                            on-error (se falhar)
                            on-ambiguity (se ambíguo)
\`\`\`
`

  return writeIfChanged(resolve(harnessRoot(), 'hooks/_index.md'), content, dryRun)
}

// ─── Utilitário ───────────────────────────────────────────────────────────────

async function writeIfChanged(path: string, content: string, dryRun: boolean): Promise<string | null> {
  try {
    const existing = await readFile(path, 'utf-8')
    if (existing === content) return null
  } catch {}

  if (!dryRun) await writeFile(path, content, 'utf-8')
  return path
}
