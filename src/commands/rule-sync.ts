import { access, mkdir, readdir, readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import {
    compareSemver,
    fetchRegistryText,
    formatSemverWarning,
    loadRegistryConfig,
    localInstallName,
    parsePackageRef,
    resolveRuleChangelogUrl,
    resolveRulePackUrl,
    scopeTokenEnv,
} from '../registry-remote.js'

function harnessDir()  { return resolve(process.cwd(), '.harness') }
function rulesDir()    { return resolve(harnessDir(), 'core/rules') }

const CUSTOM_START = '<!-- HARNESS:CUSTOM:START -->'
const CUSTOM_END   = '<!-- HARNESS:CUSTOM:END -->'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RuleMeta {
  source?: string
  version?: string
  category?: string
  synced_at?: string
  sync?: boolean
  registry_ref?: string
}

interface SyncResult {
  pack: string
  status: 'updated' | 'skipped' | 'disabled' | 'no-source' | 'error' | 'up-to-date'
  fromVersion?: string
  toVersion?: string
  error?: string
}

// ─── Comandos públicos ────────────────────────────────────────────────────────

export async function runRuleSync(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const check  = args.includes('--check')
  const target = args.find(a => !a.startsWith('--'))

  if (check) {
    await checkUpdates(target)
    return
  }

  const results = target
    ? [await syncPack(target, dryRun)]
    : await syncAllPacks(dryRun)

  printResults(results, dryRun)
}

export async function runRuleAdd(args: string[]): Promise<void> {
  const input = args[0]

  if (!input) {
    console.error('❌ Informe o pack: harness rule-add <nome> | @escopo/nome> | <url>')
    const cfg = await loadRegistryConfig()
    console.log(`\n   Registry oficial: ${cfg.rules_base_url}`)
    process.exit(1)
  }

  const registryConfig = await loadRegistryConfig()
  let ref: ReturnType<typeof parsePackageRef>
  let url: string

  try {
    ref = parsePackageRef(input)
    url = resolveRulePackUrl(input, registryConfig)
  } catch (err: unknown) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const installName = localInstallName(ref)
  const destPath = resolve(rulesDir(), `${installName}.md`)

  if (await fileExists(destPath)) {
    console.log(`⚠️  Rule pack já existe em .harness/core/rules/${installName}.md`)
    console.log('   Para atualizar: harness rule-sync ' + installName)
    return
  }

  console.log(`📥 Buscando rule pack "${input}" da registry...\n`)

  let remote: string
  try {
    remote = await fetchRegistryText(url, { tokenEnv: scopeTokenEnv(ref, registryConfig) })
  } catch {
    console.error(`❌ Rule pack "${input}" não encontrado na registry.`)
    console.log(`   URL tentada: ${url}`)
    process.exit(1)
  }

  const version = extractVersion(remote)

  const withMeta = injectLocalMeta(remote, {
    source: url,
    version: version ?? undefined,
    synced_at: today(),
    sync: true,
    registry_ref: ref.raw,
  })

  await mkdir(rulesDir(), { recursive: true })
  await writeFile(destPath, withMeta, 'utf-8')

  console.log(`✅ Rule pack instalado em .harness/core/rules/${installName}.md`)
  console.log(`   Referência: ${ref.raw}`)
  console.log(`   Versão: ${version ?? 'desconhecida'}`)
  console.log('\n   Para customizar, edite a seção:')
  console.log('   ## Customizações do projeto')
  console.log('   <!-- HARNESS:CUSTOM:START -->')
  console.log('   Suas regras aqui')
  console.log('   <!-- HARNESS:CUSTOM:END -->')
  console.log('\n   Rode "harness sync" para regenerar os adapters.')
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function syncAllPacks(dryRun: boolean): Promise<SyncResult[]> {
  const packs = await listRulePacks()
  return Promise.all(packs.map(name => syncPack(name, dryRun)))
}

async function syncPack(name: string, dryRun: boolean): Promise<SyncResult> {
  const packPath = resolve(rulesDir(), `${name}.md`)
  const local = await readFile(packPath, 'utf-8').catch(() => null)

  if (!local) {
    return { pack: name, status: 'error', error: `${name}.md não encontrado em core/rules/` }
  }

  const meta = extractMeta(local)

  if (meta.sync === false) {
    return { pack: name, status: 'disabled' }
  }

  if (!meta.source) {
    return { pack: name, status: 'no-source' }
  }

  const registryConfig = await loadRegistryConfig()
  let remote: string
  try {
    remote = await fetchRegistryText(meta.source, {
      tokenEnv: tokenEnvForRuleMeta(meta, registryConfig),
    })
  } catch (err: unknown) {
    return { pack: name, status: 'error', error: err instanceof Error ? err.message : String(err) }
  }

  const remoteVersion: string | undefined = extractVersion(remote) ?? undefined
  const semver = compareSemver(meta.version, remoteVersion)

  if (meta.version && remoteVersion === meta.version) {
    return { pack: name, status: 'up-to-date', fromVersion: meta.version }
  }

  if (!dryRun) {
    const warning = formatSemverWarning(name, meta.version, remoteVersion, semver)
    if (warning) {
      console.log(warning)
      await logRuleChangelogIfPresent(meta.source, registryConfig, meta)
    }
    const merged = mergePack(local, remote, meta)
    await writeFile(packPath, merged, 'utf-8')
  }

  return {
    pack: name,
    status: 'updated',
    fromVersion: meta.version,
    toVersion: remoteVersion,
  }
}

async function checkUpdates(target?: string): Promise<void> {
  const packs = target ? [target] : await listRulePacks()
  console.log('🔍 Verificando atualizações de rule packs...\n')

  let hasUpdates = false

  for (const name of packs) {
    const packPath = resolve(rulesDir(), `${name}.md`)
    const local = await readFile(packPath, 'utf-8').catch(() => null)
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
        tokenEnv: tokenEnvForRuleMeta(meta, registryConfig),
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

  console.log(hasUpdates
    ? '\n   Para atualizar: harness rule-sync'
    : '\n   Todos os rule packs estão atualizados.')
}

// ─── Merge ───────────────────────────────────────────────────────────────────

function mergePack(local: string, remote: string, localMeta: RuleMeta): string {
  const customBlock = extractCustomBlock(local)
  const remoteVersion = extractVersion(remote)

  const merged = injectLocalMeta(remote, {
    source: localMeta.source,
    version: remoteVersion ?? localMeta.version,
    synced_at: today(),
    sync: localMeta.sync ?? true,
    registry_ref: localMeta.registry_ref,
  })

  return injectCustomBlock(merged, customBlock)
}

// ─── CUSTOM block ─────────────────────────────────────────────────────────────

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
    return (
      content.slice(0, startIdx + CUSTOM_START.length) +
      (custom ? `\n${custom}\n` : '\n') +
      content.slice(endIdx)
    )
  }

  const section = `\n## Customizações do projeto\n\n${CUSTOM_START}\n${custom || ''}\n${CUSTOM_END}\n`
  return content.trimEnd() + section
}

// ─── Meta ────────────────────────────────────────────────────────────────────

function extractMeta(content: string): RuleMeta {
  const match = content.match(/```yaml\n([\s\S]*?)```/)
  if (!match) return {}

  const meta: RuleMeta = {}
  for (const line of match[1].split('\n')) {
    const [key, ...rest] = line.split(':')
    const value = rest.join(':').trim().replace(/['"]/g, '')
    if (key?.trim() === 'source')        meta.source        = value
    if (key?.trim() === 'version')       meta.version       = value
    if (key?.trim() === 'category')      meta.category      = value
    if (key?.trim() === 'synced_at')     meta.synced_at     = value
    if (key?.trim() === 'registry_ref')  meta.registry_ref  = value
    if (key?.trim() === 'sync')          meta.sync          = value !== 'false'
  }
  return meta
}

function extractVersion(content: string): string | null {
  return content.match(/version:\s*["']?([^\s"'\n]+)["']?/)?.[1] ?? null
}

function injectLocalMeta(content: string, localMeta: RuleMeta): string {
  const metaMatch = content.match(/(```yaml\n)([\s\S]*?)(```)/)
  if (!metaMatch) return content

  const lines = metaMatch[2].split('\n').filter(l => l.trim())

  const filtered = lines.filter(l => {
    const key = l.split(':')[0]?.trim()
    return !['source', 'sync', 'synced_at', 'registry_ref'].includes(key)
  })

  const withVersion = filtered.map(l =>
    l.trim().startsWith('version:') && localMeta.version
      ? `version: "${localMeta.version}"`
      : l
  )

  const localFields = [
    localMeta.source && `source: "${localMeta.source}"`,
    localMeta.registry_ref && `registry_ref: "${localMeta.registry_ref}"`,
    localMeta.synced_at && `synced_at: "${localMeta.synced_at}"`,
    `sync: ${localMeta.sync ?? true}`,
  ].filter(Boolean) as string[]

  const newYaml = [...withVersion, ...localFields].join('\n')
  return content.replace(/(```yaml\n)([\s\S]*?)(```)/, `\`\`\`yaml\n${newYaml}\n\`\`\``)
}

// ─── Output ───────────────────────────────────────────────────────────────────

function printResults(results: SyncResult[], dryRun: boolean): void {
  if (dryRun) console.log('🔍 Dry-run — nenhum arquivo será alterado\n')

  let updated = 0

  for (const r of results) {
    switch (r.status) {
      case 'updated':
        console.log(`✅ ${r.pack}: ${r.fromVersion ?? '?'} → ${r.toVersion ?? '?'}${dryRun ? ' (dry-run)' : ''}`)
        updated++
        break
      case 'up-to-date':
        console.log(`   ${r.pack}: atualizado (${r.fromVersion})`)
        break
      case 'disabled':
        console.log(`   ⏭️  ${r.pack}: sync desativado`)
        break
      case 'no-source':
        break
      case 'error':
        console.log(`   ❌ ${r.pack}: ${r.error}`)
        break
    }
  }

  if (updated > 0 && !dryRun) {
    console.log(`\n✨ ${updated} rule pack(s) atualizado(s). Rode "harness sync" para regenerar os adapters.`)
  } else if (updated === 0 && results.some(r => r.status !== 'no-source')) {
    console.log('\n   Todos os rule packs estão atualizados.')
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function listRulePacks(): Promise<string[]> {
  try {
    const entries = await readdir(rulesDir(), { withFileTypes: true })
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('_'))
      .map(e => e.name.replace('.md', ''))
  } catch {
    return []
  }
}

function tokenEnvForRuleMeta(
  meta: RuleMeta,
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

async function logRuleChangelogIfPresent(
  sourceUrl: string | undefined,
  config: Awaited<ReturnType<typeof loadRegistryConfig>>,
  meta: RuleMeta,
): Promise<void> {
  if (!sourceUrl) return
  const changelogUrl = resolveRuleChangelogUrl(sourceUrl)
  if (!changelogUrl) return
  try {
    const body = await fetchRegistryText(changelogUrl, {
      tokenEnv: tokenEnvForRuleMeta(meta, config),
    })
    const preview = body.trim().split('\n').slice(0, 12).join('\n')
    console.log(`\n   CHANGELOG (preview):\n${preview}\n`)
  } catch {
    // optional
  }
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}
