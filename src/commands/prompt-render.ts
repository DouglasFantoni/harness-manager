import { access, readFile } from 'fs/promises'
import { resolve } from 'path'
import type { ProjectDetails } from '../types.js'

function getRoot() { return process.cwd() }
function harnessDir() { return resolve(getRoot(), '.harness') }

/** Loads and resolves a scaffolded prompt by name (shared by \`harness prompt\` and \`harness memory summarize\`). */
export async function renderPrompt(name: string): Promise<string> {
  const promptPath = resolve(harnessDir(), `prompts/${name}.md`)

  if (!(await fileExists(promptPath))) {
    throw new Error(`Prompt não encontrado: .harness/prompts/${name}.md — rode "harness init"`)
  }

  let project: ProjectDetails | null = null
  try {
    const raw = await readFile(resolve(harnessDir(), 'project-details.json'), 'utf-8')
    project = JSON.parse(raw)
  } catch {
    // optional context
  }

  const template = await readFile(promptPath, 'utf-8')
  const context = project ? await buildPromptContext(project) : {}
  return resolvePromptVars(template, context)
}

async function buildPromptContext(project: ProjectDetails): Promise<Record<string, string>> {
  const ctx: Record<string, string> = {}

  ctx['project.name'] = project.project.name
  ctx['project.description'] = project.project.description || '(não preenchido)'
  ctx['project.type'] = project.project.type

  ctx['commands.sync'] = project.scripts?.['harness:sync'] ?? 'harness sync'
  ctx['commands.typecheck'] = project.commands.typecheck || 'typecheck (não configurado)'
  ctx['commands.lint'] = project.commands.lint || 'lint (não configurado)'
  ctx['commands.test'] = project.commands.test || 'test (não configurado)'
  ctx['commands.build'] = project.commands.build || 'build (não configurado)'

  const stackLines: string[] = []
  if (project.project.stack.backend.length) stackLines.push(`- backend: ${project.project.stack.backend.join(', ')}`)
  if (project.project.stack.frontend.length) stackLines.push(`- frontend: ${project.project.stack.frontend.join(', ')}`)
  if (project.project.stack.infra.length) stackLines.push(`- infra: ${project.project.stack.infra.join(', ')}`)
  ctx['harness.stack_summary'] = stackLines.join('\n') || '(stack não detectada)'

  ctx['harness.project_details'] = JSON.stringify(project, null, 2)

  const entryPoints = project.context_hints.entry_points
  if (entryPoints.length) {
    ctx['harness.entry_points_list'] = entryPoints.map(ep => `- \`${ep}\``).join('\n')
  } else {
    ctx['harness.entry_points_list'] = '(nenhum entry point detectado automaticamente)'
  }

  ctx['harness.glossary'] = await readHarnessFile('core/glossary.md')
  ctx['harness.rules'] = await readHarnessFile('core/rules.md')
  ctx['harness.mistakes'] = await readHarnessFile('memory/mistakes.md')
  ctx['harness.skill_template'] = await readHarnessFile('skills/_template/SKILL.md')
  ctx['harness.spec_template'] = await readHarnessFile('specs/_template.md')
  ctx['harness.patterns'] = await readHarnessFile('memory/patterns.md')
  ctx['harness.decisions'] = await readHarnessFile('memory/decisions.md')

  return ctx
}

async function readHarnessFile(relativePath: string): Promise<string> {
  try {
    return await readFile(resolve(harnessDir(), relativePath), 'utf-8')
  } catch {
    return `(arquivo não encontrado: .harness/${relativePath})`
  }
}

function resolvePromptVars(template: string, ctx: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = ctx[key.trim()]
    if (value === undefined) return match
    return value
  })
}

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}
