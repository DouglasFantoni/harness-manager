import { readFile, access } from 'fs/promises'
import { resolve, join } from 'path'
import type { ProjectDetails } from '../types.js'

function getRoot() { return process.cwd() }
function harnessDir() { return resolve(getRoot(), '.harness') }

const AVAILABLE_PROMPTS = [
  'init-enrich',
  'skill-create',
  'glossary-generate',
  'rules-generate',
  'mistakes-extract',
  'spec-create',
  'spec-implement',
  'spec-to-tests',
  'memory-summarize',
]

export async function runPrompt(args: string[]): Promise<void> {
  const name = args[0]

  if (!name || name === '--list' || name === '-l') {
    printList()
    return
  }

  if (!AVAILABLE_PROMPTS.includes(name)) {
    console.error(`❌ Prompt desconhecido: "${name}"`)
    printList()
    process.exit(1)
  }

  const promptPath = resolve(harnessDir(), `prompts/${name}.md`)

  if (!(await fileExists(promptPath))) {
    console.error(`❌ Arquivo não encontrado: .harness/prompts/${name}.md`)
    console.error('   Rode "harness init" para criar a estrutura do harness.')
    process.exit(1)
  }

  // Carrega o project-details para resolver variáveis
  let project: ProjectDetails | null = null
  try {
    const raw = await readFile(resolve(harnessDir(), 'project-details.json'), 'utf-8')
    project = JSON.parse(raw)
  } catch {
    console.warn('⚠️  project-details.json não encontrado — algumas variáveis não serão resolvidas')
  }

  const template = await readFile(promptPath, 'utf-8')
  const context = project ? await buildPromptContext(project) : {}
  const resolved = resolvePromptVars(template, context)

  // Linha separadora para fácil seleção no terminal
  const border = '─'.repeat(60)
  console.log(`\n${border}`)
  console.log(`📋  Prompt: ${name}`)
  console.log(`${border}\n`)
  console.log(resolved)
  console.log(`\n${border}`)
  console.log('💡  Selecione tudo acima da linha, copie e cole na sua IA.')
  console.log(`${border}\n`)
}

// ─── Contexto dinâmico do projeto ─────────────────────────────────────────────

async function buildPromptContext(project: ProjectDetails): Promise<Record<string, string>> {
  const ctx: Record<string, string> = {}

  // Variáveis básicas do projeto
  ctx['project.name'] = project.project.name
  ctx['project.description'] = project.project.description || '(não preenchido)'
  ctx['project.type'] = project.project.type

  // Comandos do projeto
  ctx['commands.sync'] = project.scripts?.['harness:sync'] ?? 'harness sync'
  ctx['commands.typecheck'] = project.commands.typecheck || 'typecheck (não configurado)'
  ctx['commands.lint'] = project.commands.lint || 'lint (não configurado)'
  ctx['commands.test'] = project.commands.test || 'test (não configurado)'
  ctx['commands.build'] = project.commands.build || 'build (não configurado)'

  // Stack resumida
  const stackLines: string[] = []
  if (project.project.stack.backend.length) stackLines.push(`- backend: ${project.project.stack.backend.join(', ')}`)
  if (project.project.stack.frontend.length) stackLines.push(`- frontend: ${project.project.stack.frontend.join(', ')}`)
  if (project.project.stack.infra.length) stackLines.push(`- infra: ${project.project.stack.infra.join(', ')}`)
  ctx['harness.stack_summary'] = stackLines.join('\n') || '(stack não detectada)'

  // project-details.json serializado
  ctx['harness.project_details'] = JSON.stringify(project, null, 2)

  // Lista de entry points para colar
  const entryPoints = project.context_hints.entry_points
  if (entryPoints.length) {
    ctx['harness.entry_points_list'] = entryPoints
      .map(ep => `- \`${ep}\``)
      .join('\n')
  } else {
    ctx['harness.entry_points_list'] = '(nenhum entry point detectado automaticamente)'
  }

  // Conteúdo dos arquivos do harness (para prompts que os referenciam)
  ctx['harness.glossary'] = await readHarnessFile('core/glossary.md')
  ctx['harness.rules'] = await readHarnessFile('core/rules.md')
  ctx['harness.mistakes'] = await readHarnessFile('memory/mistakes.md')
  ctx['harness.skill_template'] = await readHarnessFile('skills/_template/SKILL.md')
  ctx['harness.spec_template'] = await readHarnessFile('specs/_template.md')
  ctx['harness.patterns'] = await readHarnessFile('memory/patterns.md')
  ctx['harness.decisions'] = await readHarnessFile('memory/decisions.md')

  return ctx
}

async function readHarnessFile(relativePath: string): Promise<string> {
  try {
    return await readFile(resolve(harnessDir(), relativePath), 'utf-8')
  } catch {
    return `(arquivo não encontrado: .harness/${relativePath})`
  }
}

// ─── Resolução de variáveis ────────────────────────────────────────────────────

function resolvePromptVars(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = ctx[key.trim()]
    if (value === undefined) return match // mantém o placeholder se não encontrar
    return value
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function printList(): void {
  console.log('\n📋  Prompts disponíveis:\n')
  const descriptions: Record<string, string> = {
    'init-enrich':        'Enriquece o project-details.json após o init',
    'skill-create':       'Cria uma nova skill para um domínio do projeto',
    'glossary-generate':  'Gera o glossário inicial a partir do código',
    'rules-generate':     'Gera as regras iniciais a partir das convenções',
    'mistakes-extract':   'Extrai armadilhas do histórico de commits e PRs',
    'spec-create':        'Cria uma spec de feature a partir de uma ideia',
    'spec-implement':     'Implementa código a partir de uma spec existente',
    'spec-to-tests':      'Gera testes a partir dos critérios de aceite de uma spec',
    'memory-summarize':   'Condensa arquivos de memory que cresceram demais',
  }
  for (const [name, desc] of Object.entries(descriptions)) {
    console.log(`  harness prompt ${name.padEnd(22)} ${desc}`)
  }
  console.log()
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}
