import { access } from 'fs/promises'
import { resolve } from 'path'
import { renderPrompt } from './prompt-render.js'

function harnessDir() { return resolve(process.cwd(), '.harness') }

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

  const resolved = await renderPrompt(name)

  const border = '─'.repeat(60)
  console.log(`\n${border}`)
  console.log(`📋  Prompt: ${name}`)
  console.log(`${border}\n`)
  console.log(resolved)
  console.log(`\n${border}`)
  console.log('💡  Selecione tudo acima da linha, copie e cole na sua IA.')
  console.log(`${border}\n`)
}

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
  console.log('  harness memory status              Token counts for memory/*.md')
  console.log('  harness memory summarize           Summarize prompt when over threshold')
  console.log()
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}
