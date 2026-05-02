import { readFile } from 'fs/promises'
import { resolve } from 'path'
import type { HarnessConfig, ProjectDetails } from './types.js'

const HARNESS_ROOT = resolve(process.cwd(), '.harness')

export async function loadConfig(): Promise<{ config: HarnessConfig; project: ProjectDetails }> {
  const [configRaw, projectRaw] = await Promise.all([
    readFile(resolve(HARNESS_ROOT, 'harness.config.json'), 'utf-8').catch(() => {
      throw new Error('.harness/harness.config.json não encontrado. Rode: npx @ai-harness/cli init')
    }),
    readFile(resolve(HARNESS_ROOT, 'project-details.json'), 'utf-8').catch(() => {
      throw new Error('.harness/project-details.json não encontrado. Rode: npx @ai-harness/cli init')
    }),
  ])

  const config: HarnessConfig = JSON.parse(configRaw)
  const project: ProjectDetails = JSON.parse(projectRaw)

  validate(config, project)

  return { config, project }
}

function validate(config: HarnessConfig, project: ProjectDetails): void {
  if (!config.tools) {
    throw new Error('harness.config.json: campo "tools" ausente')
  }
  if (!project.commands) {
    throw new Error('project-details.json: campo "commands" ausente')
  }

  const required = ['lint', 'typecheck', 'test', 'build'] as const
  for (const cmd of required) {
    if (!project.commands[cmd]) {
      console.warn(`⚠️  project-details.json: comando "${cmd}" não definido`)
    }
  }
}
