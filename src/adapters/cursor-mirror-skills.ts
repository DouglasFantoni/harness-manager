import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { relative, resolve } from 'path'

function yamlQuotedScalar(s: string): string {
  return JSON.stringify(s)
}

function buildFrontmatter(name: string, description: string): string {
  return `---\nname: ${yamlQuotedScalar(name)}\ndescription: ${yamlQuotedScalar(description)}\n---`
}

/** First paragraph under `## Quando usar` (PT heading used by harness skills). */
function extractQuandoUsarParagraph(md: string): string | null {
  const lines = md.split(/\r?\n/)
  const startIdx = lines.findIndex(l => /^##\s+Quando usar\s*$/i.test(l))
  if (startIdx === -1) return null
  let i = startIdx + 1
  while (i < lines.length && lines[i].trim() === '') i++
  if (i >= lines.length) return null
  const para: string[] = []
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (/^##\s+/.test(line)) break
    if (line.trim() === '' && para.length > 0) break
    para.push(line)
  }
  const text = para.join('\n').trim().replace(/\s+/g, ' ')
  return text.length ? text : null
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = resolve(dir, e.name)
    if (e.isDirectory()) yield* walkFiles(p)
    else yield p
  }
}

/**
 * Mirrors domain folders under `.harness/skills/` (each with `SKILL.md`) and
 * markdown files under `.harness/hooks/` into the configured mirror root (see
 * `tools.cursor.agent_skills_mirror_root`) with Cursor Agent Skill frontmatter.
 * When not dry-run, replaces the whole mirror subtree first.
 */
export async function mirrorHarnessAgentSkills(opts: {
  projectRoot: string
  /** Relative path from project root; trailing slashes ignored. */
  mirrorRootRel: string
  dryRun: boolean
}): Promise<string[]> {
  const { projectRoot, dryRun, mirrorRootRel } = opts
  const harness = resolve(projectRoot, '.harness')
  const skillsSrc = resolve(harness, 'skills')
  const hooksSrc = resolve(harness, 'hooks')
  const mirrorBase = resolve(projectRoot, mirrorRootRel.trim().replace(/\/+$/, ''))
  const outFiles: string[] = []

  const recordWrite = async (dest: string, content: string) => {
    outFiles.push(dest)
    if (!dryRun) {
      await mkdir(resolve(dest, '..'), { recursive: true })
      await writeFile(dest, content, 'utf-8')
    }
  }

  const recordCopy = async (src: string, dest: string) => {
    outFiles.push(dest)
    if (!dryRun) {
      await mkdir(resolve(dest, '..'), { recursive: true })
      await copyFile(src, dest)
    }
  }

  if (!dryRun) {
    await rm(mirrorBase, { recursive: true, force: true })
  }

  // Domain skills: .harness/skills/<domain>/SKILL.md (skip _template)
  let skillDirs: string[] = []
  try {
    const entries = await readdir(skillsSrc, { withFileTypes: true })
    skillDirs = entries.filter(e => e.isDirectory() && e.name !== '_template').map(e => e.name)
  } catch {
    /* missing skills dir */
  }

  for (const domain of skillDirs) {
    const domainPath = resolve(skillsSrc, domain)
    const skillMdPath = resolve(domainPath, 'SKILL.md')
    try {
      await stat(skillMdPath)
    } catch {
      continue
    }

    const raw = await readFile(skillMdPath, 'utf-8')
    const description = extractQuandoUsarParagraph(raw) ?? `Harness skill: ${domain}`
    const destSkill = resolve(mirrorBase, 'skills', domain, 'SKILL.md')
    const wrapped = `${buildFrontmatter(domain, description)}\n${raw}`
    await recordWrite(destSkill, wrapped)

    for await (const abs of walkFiles(domainPath)) {
      const rel = relative(domainPath, abs)
      if (rel === 'SKILL.md') continue
      const dest = resolve(mirrorBase, 'skills', domain, rel)
      await recordCopy(abs, dest)
    }
  }

  // Hooks: .harness/hooks/<name>.md → .../hooks/<name>/SKILL.md
  let hookMdNames: string[] = []
  try {
    const he = await readdir(hooksSrc, { withFileTypes: true })
    hookMdNames = he.filter(e => e.isFile() && e.name.endsWith('.md')).map(e => e.name)
  } catch {
    /* missing hooks dir */
  }

  for (const file of hookMdNames) {
    const stem = file.replace(/\.md$/i, '')
    const absHook = resolve(hooksSrc, file)
    const raw = await readFile(absHook, 'utf-8')
    const { content: body } = matter(raw)
    const description = extractQuandoUsarParagraph(body) ?? `Harness hook: ${stem}`
    const destHook = resolve(mirrorBase, 'hooks', stem, 'SKILL.md')
    const wrapped = `${buildFrontmatter(stem, description)}\n${body}`
    await recordWrite(destHook, wrapped)
  }

  return outFiles
}
