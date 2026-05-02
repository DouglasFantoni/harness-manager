import { readFile, writeFile, readdir } from 'fs/promises'
import { resolve, join } from 'path'
import type { ProjectDetails } from './types.js'

const ROOT = process.cwd()

export async function generateContext(project: ProjectDetails, force = false): Promise<boolean> {
  const sections: string[] = []

  sections.push(`# Project Context — ${project.project.name}`)
  sections.push(`> Gerado automaticamente pelo harness sync. Não edite manualmente.\n`)
  sections.push(`## Stack\n${formatStack(project.project.stack)}`)
  sections.push(`## Tipo\n${project.project.type}`)
  sections.push(`## Estrutura\n${formatStructure(project)}`)
  sections.push(`## Entry Points\n${formatList(project.context_hints.entry_points)}`)
  sections.push(`## Arquivos Críticos\n${formatList(project.context_hints.critical_files)}`)
  sections.push(`## Paths a Ignorar\n${formatList(project.context_hints.avoid_paths)}`)
  sections.push(`## Packages Internos\n${await formatPackages(project)}`)
  sections.push(`## Convenções\n${formatConventions(project)}`)

  const content = sections.join('\n\n')
  const outputPath = resolve(ROOT, '.harness/core/context.md')

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

  const lines: string[] = []
  for (const pkgPath of allPaths) {
    try {
      const raw = await readFile(resolve(ROOT, pkgPath, 'package.json'), 'utf-8')
      const pkg = JSON.parse(raw)
      lines.push(`- \`${pkgPath}\` → **${pkg.name}** v${pkg.version ?? '?'}`)
    } catch {
      lines.push(`- \`${pkgPath}\` → _(package.json não encontrado)_`)
    }
  }
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
