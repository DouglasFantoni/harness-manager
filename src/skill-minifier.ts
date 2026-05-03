import { readFile, writeFile, readdir } from 'fs/promises'
import { resolve } from 'path'

function harnessRoot() { return resolve(process.cwd(), '.harness') }

// Lazy-loaded para não afetar startup quando não necessário
let _enc: { encode: (s: string) => number[] } | null = null

async function getEncoder() {
  if (!_enc) {
    const { encodingForModel } = await import('js-tiktoken')
    _enc = encodingForModel('gpt-4')
  }
  return _enc
}

export interface MinifyResult {
  path: string
  tokensBefore: number
  tokensAfter: number
  changed: boolean
}

/**
 * Gera SKILL.min.md para todas as skills que têm SKILL.md.
 *
 * Remove seções desnecessárias em runtime:
 * - ## Meta         → usado pelo registry durante sync, não pela IA
 * - ## Checklist    → coberto pelos hooks pre-task/post-task
 * - ## Referências  → navegação humana, IA já conhece a estrutura
 *
 * Mantém o essencial para a IA agir corretamente:
 * - Quando usar / Quando NÃO usar
 * - Contexto essencial
 * - Regras
 * - Padrões
 * - Protocolo de execução (se existir)
 */
export async function generateSkillMinFiles(dryRun = false): Promise<MinifyResult[]> {
  const skillsDir = resolve(harnessRoot(), 'skills')
  const results: MinifyResult[] = []

  let entries: string[] = []
  try {
    const dirs = await readdir(skillsDir, { withFileTypes: true })
    entries = dirs
      .filter(d => d.isDirectory() && !d.name.startsWith('_template'))
      .map(d => d.name)
  } catch {
    return []
  }

  const enc = await getEncoder()
  if (!enc) return []

  for (const skillName of entries) {
    const skillMdPath = resolve(skillsDir, skillName, 'SKILL.md')
    const minPath = resolve(skillsDir, skillName, 'SKILL.min.md')

    const raw = await readFile(skillMdPath, 'utf-8').catch(() => null)
    if (!raw) continue

    const minified = minify(raw)

    const tokensBefore = enc.encode(raw).length
    const tokensAfter = enc.encode(minified).length

    const existing = await readFile(minPath, 'utf-8').catch(() => null)
    const changed = existing !== minified

    if (changed && !dryRun) {
      await writeFile(minPath, minified, 'utf-8')
    }

    results.push({ path: minPath, tokensBefore, tokensAfter, changed })
  }

  return results
}

/**
 * Conta os tokens de um texto usando o mesmo encoder do sync.
 * Útil para medir contexto antes de enviar para a IA.
 */
export async function countTokens(text: string): Promise<number> {
  const enc = await getEncoder()
  return enc?.encode(text).length ?? 0
}

/**
 * Processa um SKILL.md e retorna a versão minificada.
 *
 * Algoritmo:
 * 1. Identifica seções a pular pelo cabeçalho ## {nome}
 * 2. Quando dentro de uma seção skip, descarta todas as linhas
 *    incluindo o próprio cabeçalho
 * 3. Rastreia blocos de código (``` ... ```) para não aplicar
 *    heurísticas dentro deles — código nunca é alterado
 * 4. Remove comentários HTML completos
 * 5. Colapsa linhas em branco duplicadas
 */
export function minify(content: string): string {
  const lines = content.split('\n')
  const result: string[] = []

  // Seções removidas completamente — normalizadas para lowercase
  const SKIP_SECTIONS = new Set([
    '## meta',
    '## referências',
    '## referencias',
    '## referencia',
    '## checklist de execução',
    '## checklist de execucao',
  ])

  let skipSection = false
  let insideCodeBlock = false
  let insideHtmlComment = false
  let prevWasBlank = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Rastreia abertura/fechamento de blocos de código
    // Blocos dentro de seções skip são descartados junto com a seção
    if (!skipSection && trimmed.startsWith('```')) {
      insideCodeBlock = !insideCodeBlock
      result.push(line)
      prevWasBlank = false
      continue
    }

    // Dentro de bloco de código — nunca processar, sempre manter
    if (insideCodeBlock) {
      result.push(line)
      prevWasBlank = false
      continue
    }

    // Comentários HTML multi-linha
    if (trimmed.startsWith('<!--')) {
      insideHtmlComment = true
    }
    if (insideHtmlComment) {
      if (trimmed.endsWith('-->')) insideHtmlComment = false
      continue // descarta toda linha de comentário HTML
    }

    // Detecta início de nova seção — decide skip ANTES de processar a linha
    if (trimmed.startsWith('## ')) {
      const sectionKey = trimmed.toLowerCase()
      skipSection = SKIP_SECTIONS.has(sectionKey)
      // Se a seção vai ser pulada, descarta o próprio cabeçalho também
      if (skipSection) continue
    }

    // Dentro de seção skip — descarta
    if (skipSection) continue

    // Remove linhas de instrução de template
    if (trimmed.startsWith('> Copie este arquivo') ||
        trimmed.startsWith('> Depois adicione') ||
        trimmed.startsWith('> Preencha todos os campos')) continue

    // Colapsa linhas em branco duplicadas
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

  return result.join('\n') + '\n'
}
