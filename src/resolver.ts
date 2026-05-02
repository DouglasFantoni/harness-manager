import type { ProjectDetails } from './types.js'

/**
 * Resolve {{placeholders}} nos templates usando project-details.json.
 * Suporta caminhos aninhados: {{commands.lint}}, {{project.name}}, etc.
 */
export function resolvePlaceholders(template: string, project: ProjectDetails): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getPath(project, path.trim())
    if (value === undefined) {
      console.warn(`⚠️  Placeholder não resolvido: ${match}`)
      return match
    }
    return Array.isArray(value) ? value.join(', ') : String(value)
  })
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}
