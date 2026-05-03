import { readFile, writeFile, unlink } from 'fs/promises'
import { resolve } from 'path'

function harnessRoot() { return resolve(process.cwd(), '.harness') }

/**
 * Gera SKILL.min.md para todas as skills que têm SKILL.md.
 * Remove seções que a IA não precisa em tempo de execução:
 * - ## Meta (yaml de configuração — útil para humanos, não para a IA)
 * - ## Referências (links para outros arquivos)
 * - ## Checklist de execução (incorporada no protocolo)
 * - Comentários e instruções de template
 * - Linhas em branco duplicadas
 *
 * Mantém o que importa para a IA agir corretamente:
 * - Quando usar / Quando NÃO usar
 * - Contexto essencial
 * - Regras
 * - Padrões
 * - Protocolo de execução (se existir)
 */
export async function generateSkillMinFiles(dryRun = false): Promise<string[]> {
  const skillsDir = resolve(harnessRoot(), 'skills')
  const generated: string[] = []

  // Descobre todos os SKILL.md exceto _template
  const { readdir } = await import('fs/promises')
  let entries: string[] = []
  try {
    const dirs = await readdir(skillsDir, { withFileTypes: true })
    entries = dirs
      .filter(d => d.isDirectory() && !d.name.startsWith('_template'))
      .map(d => d.name)
  } catch {
    return []
  }

  for (const skillName of entries) {
    const skillMdPath = resolve(skillsDir, skillName, 'SKILL.md')
    const minPath = resolve(skillsDir, skillName, 'SKILL.min.md')

    const raw = await readFile(skillMdPath, 'utf-8').catch(() => null)
    if (!raw) continue

    const minified = minify(raw)

    // Só escreve se mudou (idempotente)
    const existing = await readFile(minPath, 'utf-8').catch(() => null)
    if (existing === minified) continue

    if (!dryRun) {
      await writeFile(minPath, minified, 'utf-8')
    }
    generated.push(minPath)
  }

  return generated
}

/**
 * Remove seções desnecessárias para runtime e compacta o conteúdo.
 * Redução típica: 40-60% do tamanho original.
 */
function minify(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []

  // Seções a remover completamente
  const SKIP_SECTIONS = new Set([
    '## meta',
    '## referências',
    '## checklist de execução',
    '## referencia',
    '## referencias',
  ])

  let skipSection = false
  let prevWasBlank = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Detecta início de seção
    if (trimmed.startsWith('## ')) {
      const sectionKey = trimmed.toLowerCase()
      skipSection = SKIP_SECTIONS.has(sectionKey)
    }

    // Pula seções marcadas
    if (skipSection) continue

    // Remove blocos de código yaml do ## Meta mesmo se não detectado pela seção
    if (trimmed === '```yaml') {
      // Pula até fechar o bloco
      continue
    }

    // Remove comentários HTML
    if (trimmed.startsWith('<!--') && trimmed.endsWith('-->')) continue
    if (trimmed.startsWith('<!--')) {
      skipSection = true
      continue
    }
    if (trimmed.endsWith('-->')) {
      skipSection = false
      continue
    }

    // Remove linhas de instrução de template (entre > e em itálico)
    if (trimmed.startsWith('> Copie este arquivo') ||
        trimmed.startsWith('> Depois adicione') ||
        trimmed.startsWith('> Preencha todos')) continue

    // Colapsa múltiplas linhas em branco em uma
    if (trimmed === '') {
      if (prevWasBlank) continue
      prevWasBlank = true
    } else {
      prevWasBlank = false
    }

    result.push(line)
  }

  // Remove linhas em branco no início e fim
  while (result.length && result[0].trim() === '') result.shift()
  while (result.length && result[result.length - 1].trim() === '') result.pop()

  const minified = result.join('\n') + '\n'

  return minified
}
