import { cp, writeFile, readFile, access } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { detectProject } from '../detector/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCAFFOLD = resolve(__dirname, '../../scaffold')

function link(label: string, absolutePath: string): string {
  if (!process.stdout.isTTY) return label
  return `\x1b]8;;file://${absolutePath}\x07${label}\x1b]8;;\x07`
}

function getRoot() { return process.cwd() }
function harnessDir() { return resolve(getRoot(), '.harness') }

export async function runInit(args: string[]): Promise<void> {
  const force = args.includes('--force')

  console.log('🪢  AI Harness — init\n')

  // 1. Verifica se já existe
  const alreadyExists = await fileExists(harnessDir())
  if (alreadyExists && !force) {
    console.log('⚠️  .harness/ já existe neste projeto.')
    console.log('   Use --force para reinicializar (atenção: sobrescreve arquivos do scaffold).')
    console.log('   Para apenas regenerar adapters: harness sync\n')
    return
  }

  // 2. Copia o scaffold
  console.log('📁 Copiando scaffold...')

  if (!(await fileExists(SCAFFOLD))) {
    throw new Error(`Scaffold não encontrado em: ${SCAFFOLD}`)
  }

  await cp(SCAFFOLD, harnessDir(), {
    recursive: true,
    force,
    filter: (src) => !src.endsWith('project-details.json'),
  })
  console.log('   ✅ Estrutura base criada\n')

  // 3. Detecta o projeto e gera project-details.json
  const detailsPath = resolve(harnessDir(), 'project-details.json')
  const detailsExists = await fileExists(detailsPath)

  if (!detailsExists) {
    console.log('🔍 Detectando projeto...')
    const { details, reviewHints } = await detectProject()

    await writeFile(detailsPath, JSON.stringify(details, null, 2), 'utf-8')
    console.log(`   ✅ ${link('.harness/project-details.json', detailsPath)} gerado\n`)

    await patchPackageJson()
    await patchGitignore()

    console.log('─────────────────────────────────────────')
    console.log(`⚠️  REVISE ${link('.harness/project-details.json', detailsPath)} antes de continuar:\n`)
    reviewHints.forEach(hint => console.log(`   • ${hint}`))
    console.log('\n💡  Próximos passos:\n')
    console.log('   1. Revise .harness/project-details.json')
    console.log('   2. Use a IA para popular o harness automaticamente:')
    console.log('      → Abra o Claude Code ou Cursor em modo agente')
    console.log('      → Digite: /setup')
    console.log('      → A IA orquestra tudo: glossário, regras, armadilhas e skills')
    console.log('\n   Ou enriqueça manualmente passo a passo:')
    console.log('      harness prompt init-enrich')
    console.log('      harness prompt glossary-generate')
    console.log('      harness prompt rules-generate')
    console.log('\n   Quando estiver pronto: harness sync')
    console.log('─────────────────────────────────────────\n')
  } else {
    console.log('ℹ️  project-details.json já existe — mantido sem alterações\n')
    await patchPackageJson()
    await patchGitignore()
    console.log('✅ Pronto. Rode: harness sync\n')
  }

  // 4. Dica de performance
  console.log('⚡ Dicas de performance: https://github.com/DouglasFantoni/harness-manager/blob/main/PERFORMANCE.md\n')
}

// ─── Patches ─────────────────────────────────────────────────────────────────

async function patchPackageJson(): Promise<void> {
  const pkgPath = resolve(getRoot(), 'package.json')

  let pkg: Record<string, unknown>
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
  } catch {
    console.warn('⚠️  package.json não encontrado — pulando patch')
    return
  }

  const scripts = (pkg.scripts ?? {}) as Record<string, string>
  const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>

  let changed = false

  if (!('@ai-harness/cli' in devDeps) && !('@ai-harness/sync' in devDeps)) {
    devDeps['@ai-harness/cli'] = 'latest'
    pkg.devDependencies = devDeps
    changed = true
  }

  if (!scripts['harness:sync']) {
    scripts['harness:sync'] = 'harness sync'
    pkg.scripts = scripts
    changed = true
  }

  if (!scripts['harness:init']) {
    scripts['harness:init'] = 'harness init'
    pkg.scripts = scripts
    changed = true
  }

  if (changed) {
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    console.log(`   ✅ ${link('package.json', pkgPath)} atualizado`)
  } else {
    console.log(`   ✅ ${link('package.json', pkgPath)} já configurado`)
  }
}

async function patchGitignore(): Promise<void> {
  const gitignorePath = resolve(getRoot(), '.gitignore')

  const block = `
# AI Harness — gerado pelo sync
.harness/skills/**/SKILL.min.md
.harness/skills/_index.md
.harness/commands/_index.md
.harness/hooks/_index.md
CLAUDE.md
.cursor/rules/
.harness/adapters/
.harness/evolution/proposed/*
!.harness/evolution/proposed/.gitkeep
`

  let current = ''
  try {
    current = await readFile(gitignorePath, 'utf-8')
  } catch {
    // arquivo não existe — vai criar
  }

  if (current.includes('AI Harness')) {
    console.log(`   ✅ ${link('.gitignore', gitignorePath)} já configurado`)
    return
  }

  await writeFile(gitignorePath, current + block, 'utf-8')
  console.log(`   ✅ ${link('.gitignore', gitignorePath)} atualizado`)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
