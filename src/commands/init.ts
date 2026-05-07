import { cp, writeFile, readFile, access } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { detectProject } from '../detector/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCAFFOLD = resolve(__dirname, '../../scaffold')

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
    console.log('   ✅ project-details.json gerado\n')

    await patchPackageJson()
    await patchGitignore()

    console.log('\n─────────────────────────────────────────')
    console.log('⚠️  REVISE .harness/project-details.json antes de continuar:\n')
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

  // 4. Dicas de performance (sempre exibidas)
  await showPerformanceTips()
}

// ─── Dicas de performance ────────────────────────────────────────────────────

async function showPerformanceTips(): Promise<void> {
  const env = detectEnvironment()
  const tips = buildPerformanceTips(env)

  if (!tips.length) return

  console.log('⚡ Dicas de performance:\n')
  tips.forEach(tip => console.log(tip))
  console.log()
}

interface Environment {
  hasRipgrep: boolean
  isWSL: boolean
  projectOnWindowsMount: boolean
  useBuiltinRipgrep: string | undefined
}

function detectEnvironment(): Environment {
  const hasRipgrep = commandExists('rg')
  const isWSL = checkIsWSL()
  const projectOnWindowsMount = isWSL && getRoot().startsWith('/mnt/')
  const useBuiltinRipgrep = process.env.USE_BUILTIN_RIPGREP

  return { hasRipgrep, isWSL, projectOnWindowsMount, useBuiltinRipgrep }
}

function buildPerformanceTips(env: Environment): string[] {
  const tips: string[] = []

  // Tip 1 — ripgrep não instalado no sistema
  if (!env.hasRipgrep) {
    tips.push('   📦 ripgrep não encontrado no sistema.')
    tips.push('      Instale para buscas mais rápidas e menos ruído de tokens:\n')

    if (env.isWSL) {
      tips.push('      sudo apt install ripgrep')
    } else if (process.platform === 'darwin') {
      tips.push('      brew install ripgrep')
    } else {
      tips.push('      sudo apt install ripgrep   # Ubuntu/Debian')
      tips.push('      sudo dnf install ripgrep   # Fedora')
      tips.push('      sudo pacman -S ripgrep     # Arch')
    }
    tips.push('')
  }

  // Tip 2 — ripgrep instalado mas Claude Code ainda usa o bundled
  if (env.hasRipgrep && env.useBuiltinRipgrep !== '0') {
    tips.push('   🚀 ripgrep instalado! Para que o Claude Code use o sistema')
    tips.push('      ao invés da versão bundled (5-10x mais rápido em monorepos):')
    tips.push('')
    tips.push('      echo \'export USE_BUILTIN_RIPGREP=0\' >> ~/.zshrc')
    tips.push('      source ~/.zshrc')
    tips.push('')
  }

  // Tip 3 — USE_BUILTIN_RIPGREP=0 já configurado, confirmar
  if (env.hasRipgrep && env.useBuiltinRipgrep === '0') {
    tips.push('   ✅ ripgrep do sistema ativo (USE_BUILTIN_RIPGREP=0)')
  }

  // Tip 4 — projeto em /mnt/ no WSL
  if (env.projectOnWindowsMount) {
    tips.push('   ⚠️  Projeto em mount do Windows (/mnt/...) detectado.')
    tips.push('      Buscas no WSL são muito mais lentas em /mnt/c/ do que em /home/.')
    tips.push('      Para melhor performance, mova o projeto para o filesystem Linux:')
    tips.push('')
    tips.push('      mv /mnt/c/seu-projeto ~/projetos/seu-projeto')
    tips.push('')
  }

  return tips
}

// ─── Helpers de detecção ─────────────────────────────────────────────────────

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function checkIsWSL(): boolean {
  try {
    const release = readFileSync('/proc/version', 'utf-8').toLowerCase()
    return release.includes('microsoft') || release.includes('wsl')
  } catch {
    return false
  }
}

// readFileSync síncrono — só usado na detecção de ambiente, não no caminho principal
function readFileSync(path: string, encoding: BufferEncoding): string {
  const { readFileSync: rfs } = require('fs')
  return rfs(path, encoding)
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
    console.log('   ✅ package.json atualizado')
  } else {
    console.log('   ✅ package.json já configurado')
  }
}

async function patchGitignore(): Promise<void> {
  const gitignorePath = resolve(getRoot(), '.gitignore')

  const block = `
# AI Harness — gerado pelo sync
.harness/skills/**/SKILL.min.md
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
