
/**
 * Carrega todas as regras do projeto:
 * - .harness/core/rules.md (arquivo base, sempre)
 * - .harness/core/rules/*.md (packs instalados via rule-add)
 * Retorna o conteúdo concatenado.
 */
export async function loadAllRules(harnessRoot: string): Promise<string> {
  const { readFile, readdir } = await import('fs/promises')
  const { resolve } = await import('path')
  const matter = (await import('gray-matter')).default

  const parts: string[] = []

  // 1. rules.md base
  try {
    const raw = await readFile(resolve(harnessRoot, 'core/rules.md'), 'utf-8')
    const { content } = matter(raw)
    parts.push(content.trim())
  } catch {}

  // 2. core/rules/*.md (packs)
  try {
    const entries = await readdir(resolve(harnessRoot, 'core/rules'), { withFileTypes: true })
    const packs = entries
      .filter(e => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('_'))
      .map(e => e.name)
      .sort()

    for (const pack of packs) {
      const raw = await readFile(resolve(harnessRoot, 'core/rules', pack), 'utf-8')
      const { content } = matter(raw)
      parts.push(content.trim())
    }
  } catch {}

  return parts.join('\n\n---\n\n')
}
