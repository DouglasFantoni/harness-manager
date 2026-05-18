import { access, mkdir, readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import {
    compareSemver,
    fetchRegistryText,
    formatSemverWarning,
    loadRegistryConfig,
    localInstallName,
    parsePackageRef,
    resolveSkillChangelogUrl,
    resolveSkillUrl,
    scopeTokenEnv,
} from '../registry-remote.js'

function harnessDir() { return resolve(process.cwd(), '.harness') }
function skillsDir() { return resolve(harnessDir(), 'skills') }

const CUSTOM_START = '<!-- HARNESS:CUSTOM:START -->'
const CUSTOM_END   = '<!-- HARNESS:CUSTOM:END -->'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SkillMeta {
  source?: string
  version?: string
  synced_at?: string
  sync?: boolean
  registry_ref?: string
}

interface SyncResult {
  skill: string
  status: 'updated' | 'skipped' | 'disabled' | 'no-source' | 'error' | 'up-to-date'
  fromVersion?: string
  toVersion?: string
  error?: string
  breaking?: boolean
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
  const input = args[0]

  if (!input) {
    console.error('❌ Informe a skill: harness skill-add <nome> | @escopo/nome> | <url>')
    const cfg = await loadRegistryConfig()
    console.log(`\n   Registry oficial: ${cfg.skills_base_url}`)
    console.log('   Escopos privados: registry.scopes em harness.config.json')
    process.exit(1)
  }

  const registryConfig = await loadRegistryConfig()
  let ref: ReturnType<typeof parsePackageRef>
  let url: string

  try {
    ref = parsePackageRef(input)
    url = resolveSkillUrl(input, registryConfig)
  } catch (err: unknown) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const installName = localInstallName(ref)
  const destDir = resolve(skillsDir(), installName)
  const destPath = resolve(destDir, 'SKILL.md')

  if (await fileExists(destPath)) {
    console.log(`⚠️  Skill já existe em .harness/skills/${installName}/`)
    console.log('   Para atualizar: harness skill-sync ' + installName)
    return
  }

  console.log(`📥 Buscando skill "${input}" da registry...\n`)

  let remote: string
  try {
    remote = await fetchRegistryText(url, { tokenEnv: scopeTokenEnv(ref, registryConfig) })
  } catch {
    console.error(`❌ Skill "${input}" não encontrada na registry.`)
    console.log(`   URL tentada: ${url}`)
    process.exit(1)
  }

  const version = extractVersion(remote) ?? undefined
  const withMeta = injectLocalMeta(remote, {
    source: url,
    version,
    synced_at: today(),
    sync: true,
    registry_ref: ref.raw,
  })

  await mkdir(destDir, { recursive: true })
  await writeFile(destPath, withMeta, 'utf-8')

  console.log(`✅ Skill instalada em .harness/skills/${installName}/SKILL.md`)
  console.log(`   Referência: ${ref.raw}`)
  console.log(`   Versão: ${version ?? 'desconhecida'}`)
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

  const registryConfig = await loadRegistryConfig()
  let remote: string
  try {
    remote = await fetchRegistryText(meta.source, {
      tokenEnv: tokenEnvForSkillMeta(meta, registryConfig),
    })
  } catch (err: unknown) {
    return { skill: name, status: 'error', error: err instanceof Error ? err.message : String(err) }
  }

  const remoteVersion: string | undefined = extractVersion(remote) ?? undefined
  const semver = compareSemver(meta.version, remoteVersion)

  // Mesma versão — sem mudanças
  if (meta.version && remoteVersion === meta.version) {
    return { skill: name, status: 'up-to-date', fromVersion: meta.version }
  }

  if (!dryRun) {
    const warning = formatSemverWarning(name, meta.version, remoteVersion, semver)
    if (warning) {
      console.log(warning)
      await logChangelogIfPresent(meta.source, registryConfig, meta)
    }
    const merged = mergeSkill(local, remote, meta)
    await writeFile(skillPath, merged, 'utf-8')
  }

  return {
    skill: name,
    status: 'updated',
    fromVersion: meta.version,
    toVersion: remoteVersion ?? undefined,
    breaking: semver.breaking,
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
      const registryConfig = await loadRegistryConfig()
      const remote = await fetchRegistryText(meta.source, {
        tokenEnv: tokenEnvForSkillMeta(meta, registryConfig),
      })
      const remoteVersion = extractVersion(remote)
      const semver = compareSemver(meta.version, remoteVersion)

      if (remoteVersion && remoteVersion !== meta.version) {
        const majorTag = semver.breaking ? ' ⚠️ MAJOR' : ''
        console.log(`   🆕 ${name}: ${meta.version ?? '?'} → ${remoteVersion}${majorTag}`)
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
    registry_ref: localMeta.registry_ref,
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

    if (key?.trim() === 'source')        meta.source        = value
    if (key?.trim() === 'version')       meta.version       = value
    if (key?.trim() === 'synced_at')     meta.synced_at     = value
    if (key?.trim() === 'registry_ref')  meta.registry_ref  = value
    if (key?.trim() === 'sync')          meta.sync          = value !== 'false'
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
    return !['source', 'sync', 'synced_at', 'registry_ref'].includes(key)
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
  if (localMeta.source)       localFields.push(`source: "${localMeta.source}"`)
  if (localMeta.registry_ref) localFields.push(`registry_ref: "${localMeta.registry_ref}"`)
  if (localMeta.synced_at)    localFields.push(`synced_at: "${localMeta.synced_at}"`)
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

function tokenEnvForSkillMeta(
  meta: SkillMeta,
  config: Awaited<ReturnType<typeof loadRegistryConfig>>,
): string | undefined {
  if (!meta.registry_ref) return undefined
  try {
    const ref = parsePackageRef(meta.registry_ref)
    return scopeTokenEnv(ref, config)
  } catch {
    return undefined
  }
}

async function logChangelogIfPresent(
  sourceUrl: string | undefined,
  config: Awaited<ReturnType<typeof loadRegistryConfig>>,
  meta: SkillMeta,
): Promise<void> {
  if (!sourceUrl) return
  const changelogUrl = resolveSkillChangelogUrl(sourceUrl)
  if (!changelogUrl) return
  try {
    const body = await fetchRegistryText(changelogUrl, {
      tokenEnv: tokenEnvForSkillMeta(meta, config),
    })
    const preview = body.trim().split('\n').slice(0, 12).join('\n')
    console.log(`\n   CHANGELOG (preview):\n${preview}\n`)
  } catch {
    // optional file
  }
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
