import { readFile, writeFile } from 'fs/promises'
import { resolve, join } from 'path'
import type { ProjectDetails } from './types.js'

function getRoot() { return process.cwd() }

export async function generateContext(project: ProjectDetails, force = false): Promise<boolean> {
  const sections: string[] = [
    `# Project Context — ${project.project.name}`,
    `> Gerado automaticamente pelo harness sync. Não edite manualmente.\n`,
    `## Stack\n${formatStack(project.project.stack)}`,
    `## Tipo\n${project.project.type}`,
    `## Estrutura\n${formatStructure(project)}`,
    `## Entry Points\n${formatList(project.context_hints.entry_points)}`,
    `## Arquivos Críticos\n${formatList(project.context_hints.critical_files)}`,
    `## Paths a Ignorar\n${formatList(project.context_hints.avoid_paths)}`,
    `## Packages Internos\n${await formatPackages(project)}`,
    `## Convenções\n${formatConventions(project)}`,
  ]

  // B9/M3 — filtra seções vazias antes de join
  const content = sections.filter(Boolean).join('\n\n')
  const outputPath = resolve(getRoot(), '.harness/core/context.md')

  if (!force) {
    try {
      const existing = await readFile(outputPath, 'utf-8')
      if (existing === content) return false
    } catch {
      // arquivo não existe ainda — segue para criar
    }
  }

  await writeFile(outputPath, content, 'utf-8')
  return true
}

async function formatPackages(project: ProjectDetails): Promise<string> {
  const allPaths = [...project.structure.packages, ...project.structure.apps]
  if (!allPaths.length) return '_Nenhum package definido_'

  const lines = await Promise.all(allPaths.map(async pkgPath => {
    try {
      const raw = await readFile(resolve(getRoot(), pkgPath, 'package.json'), 'utf-8')
      const pkg = JSON.parse(raw)
      return `- \`${pkgPath}\` → **${pkg.name}** v${pkg.version ?? '?'}`
    } catch {
      return `- \`${pkgPath}\` → _(package.json não encontrado)_`
    }
  }))

  return lines.join('\n')
}

function formatStack(stack: ProjectDetails['project']['stack']): string {
  return Object.entries(stack)
    .filter(([, techs]) => techs.length > 0)
    .map(([area, techs]) => `- **${area}**: ${techs.join(', ')}`)
    .join('\n') || '_Stack não definida_'
}

function formatStructure(project: ProjectDetails): string {
  const lines: string[] = []
  if (project.structure.apps.length) {
    lines.push(`**Apps**: ${project.structure.apps.map(a => `\`${a}\``).join(', ')}`)
  }
  if (project.structure.packages.length) {
    lines.push(`**Packages**: ${project.structure.packages.map(p => `\`${p}\``).join(', ')}`)
  }
  return lines.join('\n') || `Raiz: \`${project.structure.root}\``
}

function formatConventions(project: ProjectDetails): string {
  const c = project.conventions
  const lines: string[] = []
  if (c.branch_pattern) lines.push(`- **Branch**: \`${c.branch_pattern}\``)
  if (c.commit_pattern) lines.push(`- **Commit**: ${c.commit_pattern}`)
  if (c.pr_template) lines.push(`- **PR template**: \`${c.pr_template}\``)
  return lines.join('\n') || '_Convenções não definidas_'
}

function formatList(items: string[]): string {
  if (!items.length) return '_Nenhum item definido_'
  return items.map(i => `- \`${i}\``).join('\n')
}
