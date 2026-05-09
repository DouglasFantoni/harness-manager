import { readFile, writeFile, mkdir, access } from 'fs/promises'
import { resolve } from 'path'

function harnessDir() { return resolve(process.cwd(), '.harness') }
function skillsDir() { return resolve(harnessDir(), 'skills') }

const CUSTOM_START = '<!-- HARNESS:CUSTOM:START -->'
const CUSTOM_END   = '<!-- HARNESS:CUSTOM:END -->'

const REGISTRY_BASE = 'https://raw.githubusercontent.com/DouglasFantoni/harness-manager/main/registry/skills'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SkillMeta {
  source?: string
  version?: string
  synced_at?: string
  sync?: boolean
}

interface SyncResult {
  skill: string
  status: 'updated' | 'skipped' | 'disabled' | 'no-source' | 'error' | 'up-to-date'
  fromVersion?: string
  toVersion?: string
  error?: string
}

// ─── Comandos públicos ────────────────────────────────────────────────────────

export async function runSkillSync(args: string[]): Promise<void> {
  const dryRun  = args.includes('--dry-run')
  const check   = args.includes('--check')
  const target  = args.find(a => !a.startsWith('--'))

  if (check) {
    await checkUpdates(target)
    return
  }

  const results = target
    ? [await syncSkill(target, dryRun)]
    : await syncAllSkills(dryRun)

  printSyncResults(results, dryRun)
}

export async function runSkillAdd(args: string[]): Promise<void> {
  const name = args[0]

  if (!name) {
    console.error('❌ Informe o nome da skill: harness skill-add <nome>')
    console.log(`\n   Skills disponíveis em: ${REGISTRY_BASE}/../README.md`)
    process.exit(1)
  }

  const url = `${REGISTRY_BASE}/${name}/SKILL.md`
  const destDir = resolve(skillsDir(), name)
  const destPath = resolve(destDir, 'SKILL.md')

  if (await fileExists(destPath)) {
    console.log(`⚠️  Skill "${name}" já existe em .harness/skills/${name}/`)
    console.log('   Para atualizar: harness skill-sync ' + name)
    return
  }

  console.log(`📥 Buscando skill "${name}" da registry...\n`)

  let remote: string
  try {
    remote = await fetchRemote(url)
  } catch {
    console.error(`❌ Skill "${name}" não encontrada na registry.`)
    console.log(`   URL tentada: ${url}`)
    console.log(`\n   Skills disponíveis: ${REGISTRY_BASE}/../README.md`)
    process.exit(1)
  }

  // Injeta meta local (source, sync) no SKILL.md remoto
  const withMeta = injectLocalMeta(remote, {
    source: url,
    version: extractVersion(remote) ?? undefined,
    synced_at: today(),
    sync: true,
  })

  await mkdir(destDir, { recursive: true })
  await writeFile(destPath, withMeta, 'utf-8')

  console.log(`✅ Skill "${name}" instalada em .harness/skills/${name}/SKILL.md`)
  console.log(`   Versão: ${extractVersion(remote) ?? 'desconhecida'}`)
  console.log(`   Source: ${url}`)
  console.log('\n   Para customizar, edite a seção:')
  console.log('   ## Customizações do projeto')
  console.log('   <!-- HARNESS:CUSTOM:START -->')
  console.log('   Suas regras aqui')
  console.log('   <!-- HARNESS:CUSTOM:END -->')
  console.log('\n   Rode "harness sync" para gerar os adapters.')
}

// ─── Lógica de sync ──────────────────────────────────────────────────────────

async function syncAllSkills(dryRun: boolean): Promise<SyncResult[]> {
  const dirs = await listSkillDirs()
  return Promise.all(dirs.map(name => syncSkill(name, dryRun)))
}

async function syncSkill(name: string, dryRun: boolean): Promise<SyncResult> {
  const skillPath = resolve(skillsDir(), name, 'SKILL.md')

  const local = await readFile(skillPath, 'utf-8').catch(() => null)
  if (!local) {
    return { skill: name, status: 'error', error: 'SKILL.md não encontrado' }
  }

  const meta = extractMeta(local)

  // Sync desativado para esta skill
  if (meta.sync === false) {
    return { skill: name, status: 'disabled' }
  }

  // Sem source declarado — skill local, não sincronizável
  if (!meta.source) {
    return { skill: name, status: 'no-source' }
  }

  let remote: string
  try {
    remote = await fetchRemote(meta.source)
  } catch (err: any) {
    return { skill: name, status: 'error', error: err.message }
  }

  const remoteVersion: string | undefined = extractVersion(remote) ?? undefined

  // Mesma versão — sem mudanças
  if (meta.version && remoteVersion === meta.version) {
    return { skill: name, status: 'up-to-date', fromVersion: meta.version }
  }

  if (!dryRun) {
    const merged = mergeSkill(local, remote, meta)
    await writeFile(skillPath, merged, 'utf-8')
  }

  return {
    skill: name,
    status: 'updated',
    fromVersion: meta.version,
    toVersion: remoteVersion ?? undefined,
  }
}

async function checkUpdates(target?: string): Promise<void> {
  const dirs = target ? [target] : await listSkillDirs()
  console.log('🔍 Verificando atualizações...\n')

  let hasUpdates = false

  for (const name of dirs) {
    const skillPath = resolve(skillsDir(), name, 'SKILL.md')
    const local = await readFile(skillPath, 'utf-8').catch(() => null)
    if (!local) continue

    const meta = extractMeta(local)
    if (!meta.source) continue
    if (meta.sync === false) {
      console.log(`   ⏭️  ${name}: sync desativado`)
      continue
    }

    try {
      const remote = await fetchRemote(meta.source)
      const remoteVersion = extractVersion(remote)

      if (remoteVersion && remoteVersion !== meta.version) {
        console.log(`   🆕 ${name}: ${meta.version ?? '?'} → ${remoteVersion}`)
        hasUpdates = true
      } else {
        console.log(`   ✅ ${name}: atualizado (${meta.version ?? '?'})`)
      }
    } catch {
      console.log(`   ❌ ${name}: falha ao buscar source`)
    }
  }

  if (hasUpdates) {
    console.log('\n   Para atualizar: harness skill-sync')
  } else {
    console.log('\n   Todas as skills estão atualizadas.')
  }
}

// ─── Merge ───────────────────────────────────────────────────────────────────

/**
 * Faz o merge do conteúdo remoto com as customizações locais.
 *
 * Preserva:
 * - Seção HARNESS:CUSTOM (entre os marcadores)
 * - Meta local: source, sync, synced_at
 *
 * Substitui pelo remote:
 * - Todo o restante do conteúdo
 * - version (atualiza para a versão remota)
 */
function mergeSkill(local: string, remote: string, localMeta: SkillMeta): string {
  // 1. Extrai customizações locais
  const customBlock = extractCustomBlock(local)

  // 2. Injeta meta local no remote (preserva source, sync; atualiza synced_at)
  const remoteVersion = extractVersion(remote)
  const merged = injectLocalMeta(remote, {
    source: localMeta.source,
    version: remoteVersion ?? localMeta.version,
    synced_at: today(),
    sync: localMeta.sync ?? true,
  })

  // 3. Injeta o bloco de customização no remote
  return injectCustomBlock(merged, customBlock)
}

// ─── Manipulação de CUSTOM ───────────────────────────────────────────────────

function extractCustomBlock(content: string): string {
  const start = content.indexOf(CUSTOM_START)
  const end   = content.indexOf(CUSTOM_END)

  if (start === -1 || end === -1) return ''
  return content.slice(start + CUSTOM_START.length, end).trim()
}

function injectCustomBlock(content: string, custom: string): string {
  const startIdx = content.indexOf(CUSTOM_START)
  const endIdx   = content.indexOf(CUSTOM_END)

  if (startIdx !== -1 && endIdx !== -1) {
    // Substitui bloco existente
    return (
      content.slice(0, startIdx + CUSTOM_START.length) +
      (custom ? `\n${custom}\n` : '\n') +
      content.slice(endIdx)
    )
  }

  // Adiciona seção de customização no final se não existir
  const section = `\n## Customizações do projeto\n\n${CUSTOM_START}\n${custom || ''}\n${CUSTOM_END}\n`
  return content.trimEnd() + section
}

// ─── Meta ────────────────────────────────────────────────────────────────────

function extractMeta(content: string): SkillMeta {
  const metaMatch = content.match(/```yaml\n([\s\S]*?)```/)
  if (!metaMatch) return {}

  const meta: SkillMeta = {}
  const lines = metaMatch[1].split('\n')

  for (const line of lines) {
    const [key, ...rest] = line.split(':')
    const value = rest.join(':').trim().replace(/['"]/g, '')

    if (key?.trim() === 'source')     meta.source     = value
    if (key?.trim() === 'version')    meta.version    = value
    if (key?.trim() === 'synced_at')  meta.synced_at  = value
    if (key?.trim() === 'sync')       meta.sync       = value !== 'false'
  }

  return meta
}

function extractVersion(content: string): string | null {
  const match = content.match(/version:\s*["']?([^\s"'\n]+)["']?/)
  return match?.[1] ?? null
}

/**
 * Injeta ou atualiza campos locais do Meta no conteúdo do SKILL.md.
 * Campos locais (source, sync, synced_at) são sempre do projeto local.
 * Campos remotos (version, domain, weight, etc.) vêm do remote.
 */
function injectLocalMeta(content: string, localMeta: SkillMeta): string {
  const metaMatch = content.match(/(```yaml\n)([\s\S]*?)(```)/)
  if (!metaMatch) return content

  const yamlBlock = metaMatch[2]
  const lines = yamlBlock.split('\n').filter(l => l.trim())

  // Remove campos locais que possam estar no remote (não devem sobrescrever)
  const filtered = lines.filter(l => {
    const key = l.split(':')[0]?.trim()
    return !['source', 'sync', 'synced_at'].includes(key)
  })

  // Atualiza version se fornecida
  const withVersion = filtered.map(l => {
    if (l.trim().startsWith('version:') && localMeta.version) {
      return `version: "${localMeta.version}"`
    }
    return l
  })

  // Adiciona campos locais no final do bloco
  const localFields: string[] = []
  if (localMeta.source)    localFields.push(`source: "${localMeta.source}"`)
  if (localMeta.synced_at) localFields.push(`synced_at: "${localMeta.synced_at}"`)
  localFields.push(`sync: ${localMeta.sync ?? true}`)

  const newYaml = [...withVersion, ...localFields].join('\n')

  return content.replace(
    /(```yaml\n)([\s\S]*?)(```)/,
    `\`\`\`yaml\n${newYaml}\n\`\`\``
  )
}

// ─── Output ───────────────────────────────────────────────────────────────────

function printSyncResults(results: SyncResult[], dryRun: boolean): void {
  console.log(dryRun ? '🔍 Dry-run — nenhum arquivo será alterado\n' : '')

  let updated = 0

  for (const r of results) {
    switch (r.status) {
      case 'updated':
        console.log(`✅ ${r.skill}: ${r.fromVersion ?? '?'} → ${r.toVersion ?? '?'}${dryRun ? ' (dry-run)' : ''}`)
        updated++
        break
      case 'up-to-date':
        console.log(`   ${r.skill}: já atualizado (${r.fromVersion})`)
        break
      case 'disabled':
        console.log(`   ⏭️  ${r.skill}: sync desativado`)
        break
      case 'no-source':
        break // skill local — silencioso
      case 'error':
        console.log(`   ❌ ${r.skill}: ${r.error}`)
        break
    }
  }

  if (updated > 0 && !dryRun) {
    console.log(`\n✨ ${updated} skill(s) atualizada(s). Rode "harness sync" para regenerar os adapters.`)
  } else if (updated === 0) {
    console.log('\n   Todas as skills estão atualizadas.')
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchRemote(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`)
  return res.text()
}

async function listSkillDirs(): Promise<string[]> {
  const { readdir } = await import('fs/promises')
  try {
    const entries = await readdir(skillsDir(), { withFileTypes: true })
    return entries
      .filter(e => e.isDirectory() && !e.name.startsWith('_'))
      .map(e => e.name)
  } catch {
    return []
  }
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}
