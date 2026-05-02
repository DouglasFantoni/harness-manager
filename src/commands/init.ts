import { cp, writeFile, readFile, access, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { detectProject } from '../detector/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = process.cwd()
const SCAFFOLD = resolve(__dirname, '../../../scaffold')
const HARNESS_DIR = resolve(ROOT, '.harness')

export async function runInit(args: string[]): Promise<void> {
  const force = args.includes('--force')

  console.log('🪢  AI Harness — init\n')

  // 1. Verifica se já existe
  const alreadyExists = await fileExists(HARNESS_DIR)
  if (alreadyExists && !force) {
    console.log('⚠️  .harness/ já existe neste projeto.')
    console.log('   Use --force para reinicializar (atenção: sobrescreve arquivos do scaffold).')
    console.log('   Para apenas regenerar adapters: harness sync\n')
    process.exit(0)
  }

  // 2. Copia o scaffold (nunca sobrescreve project-details.json se existir)
  console.log('📁 Copiando scaffold...')
  await cp(SCAFFOLD, HARNESS_DIR, {
    recursive: true,
    force,
    filter: (src) => {
      // Nunca sobrescreve project-details.json — é arquivo do usuário
      if (src.endsWith('project-details.json')) return false
      return true
    },
  })
  console.log('   ✅ Estrutura base criada\n')

  // 3. Detecta o projeto e gera project-details.json
  const detailsPath = resolve(HARNESS_DIR, 'project-details.json')
  const detailsExists = await fileExists(detailsPath)

  if (!detailsExists) {
    console.log('🔍 Detectando projeto...')
    const { details, reviewHints } = await detectProject()

    await writeFile(detailsPath, JSON.stringify(details, null, 2), 'utf-8')
    console.log('   ✅ project-details.json gerado\n')

    // 4. Patcha package.json
    await patchPackageJson()

    // 5. Patcha .gitignore
    await patchGitignore()

    // 6. Exibe hints e para para revisão
    console.log('─────────────────────────────────────────')
    console.log('⚠️  REVISE .harness/project-details.json antes de continuar:\n')
    reviewHints.forEach(hint => console.log(`   • ${hint}`))
    console.log('\n   Quando estiver pronto:')
    console.log('   pnpm harness:sync')
    console.log('─────────────────────────────────────────\n')
  } else {
    console.log('ℹ️  project-details.json já existe — mantido sem alterações\n')
    await patchPackageJson()
    await patchGitignore()
    console.log('✅ Pronto. Rode: pnpm harness:sync\n')
  }
}

async function patchPackageJson(): Promise<void> {
  const pkgPath = resolve(ROOT, 'package.json')

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

  if (!('@ai-harness/sync' in devDeps)) {
    devDeps['@ai-harness/sync'] = 'latest'
    pkg.devDependencies = devDeps
    changed = true
  }

  if (!scripts['harness:sync']) {
    scripts['harness:sync'] = 'harness sync'
    pkg.scripts = scripts
    changed = true
  }

  if (!scripts['harness:init']) {
    scripts['harness:init'] = 'harness sync --init'
    pkg.scripts = scripts
    changed = true
  }

  if (changed) {
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    console.log('   ✅ package.json atualizado')
  } else {
    console.log('   ✅ package.json já configurado')
  }
}

async function patchGitignore(): Promise<void> {
  const gitignorePath = resolve(ROOT, '.gitignore')

  const block = `
# AI Harness — gerado pelo sync
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
    console.log('   ✅ .gitignore já configurado')
    return
  }

  await writeFile(gitignorePath, current + block, 'utf-8')
  console.log('   ✅ .gitignore atualizado')
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
