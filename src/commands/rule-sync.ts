import { readFile, writeFile, mkdir, access, readdir } from 'fs/promises'
import { resolve } from 'path'

function harnessDir()  { return resolve(process.cwd(), '.harness') }
function rulesDir()    { return resolve(harnessDir(), 'core/rules') }

const CUSTOM_START = '<!-- HARNESS:CUSTOM:START -->'
const CUSTOM_END   = '<!-- HARNESS:CUSTOM:END -->'

const REGISTRY_BASE = 'https://raw.githubusercontent.com/DouglasFantoni/harness-manager/main/registry/rules'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RuleMeta {
  source?: string
  version?: string
  category?: string
  synced_at?: string
  sync?: boolean
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
  const name = args[0]

  if (!name) {
    console.error('❌ Informe o nome do rule pack: harness rule-add <nome>')
    console.log('\n   Packs disponíveis: typescript, nestjs, security, git')
    process.exit(1)
  }

  const url      = `${REGISTRY_BASE}/${name}.md`
  const destPath = resolve(rulesDir(), `${name}.md`)

  if (await fileExists(destPath)) {
    console.log(`⚠️  Rule pack "${name}" já existe em .harness/core/rules/${name}.md`)
    console.log('   Para atualizar: harness rule-sync ' + name)
    return
  }

  console.log(`📥 Buscando rule pack "${name}" da registry...\n`)

  let remote: string
  try {
    remote = await fetchRemote(url)
  } catch {
    console.error(`❌ Rule pack "${name}" não encontrado na registry.`)
    console.log(`   URL tentada: ${url}`)
    console.log('\n   Packs disponíveis: typescript, nestjs, security, git')
    process.exit(1)
  }

  const version = extractVersion(remote)

  const withMeta = injectLocalMeta(remote, {
    source: url,
    version: version ?? undefined,
    synced_at: today(),
    sync: true,
  })

  await mkdir(rulesDir(), { recursive: true })
  await writeFile(destPath, withMeta, 'utf-8')

  console.log(`✅ Rule pack "${name}" instalado em .harness/core/rules/${name}.md`)
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

  let remote: string
  try {
    remote = await fetchRemote(meta.source)
  } catch (err: any) {
    return { pack: name, status: 'error', error: err.message }
  }

  const remoteVersion: string | undefined = extractVersion(remote) ?? undefined

  if (meta.version && remoteVersion === meta.version) {
    return { pack: name, status: 'up-to-date', fromVersion: meta.version }
  }

  if (!dryRun) {
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
    if (key?.trim() === 'source')    meta.source    = value
    if (key?.trim() === 'version')   meta.version   = value
    if (key?.trim() === 'category')  meta.category  = value
    if (key?.trim() === 'synced_at') meta.synced_at = value
    if (key?.trim() === 'sync')      meta.sync      = value !== 'false'
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
    return !['source', 'sync', 'synced_at'].includes(key)
  })

  const withVersion = filtered.map(l =>
    l.trim().startsWith('version:') && localMeta.version
      ? `version: "${localMeta.version}"`
      : l
  )

  const localFields = [
    localMeta.source    && `source: "${localMeta.source}"`,
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

async function fetchRemote(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}
