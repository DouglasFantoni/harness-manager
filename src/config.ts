import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { validateEvolutionConfig } from './evolution/config.js'
import type { HarnessConfig, ProjectDetails, RegistryConfig } from './types.js'

/** Default when `tools.cursor.agent_skills_mirror_root` is omitted (older configs). */
export const DEFAULT_AGENT_SKILLS_MIRROR_ROOT = '.cursor/skills/_harness'

/** Default when `tools.copilot.copilot_mirror_root` is omitted. */
export const DEFAULT_COPILOT_MIRROR_ROOT = '.github/harness'

function harnessRoot() {
  return resolve(process.cwd(), '.harness')
}

export async function loadConfig(): Promise<{ config: HarnessConfig; project: ProjectDetails }> {
  const root = harnessRoot()

  const [configRaw, projectRaw] = await Promise.all([
    readFile(resolve(root, 'harness.config.json'), 'utf-8').catch(() => {
      throw new Error('.harness/harness.config.json não encontrado. Rode: npx @ai-harness/cli init')
    }),
    readFile(resolve(root, 'project-details.json'), 'utf-8').catch(() => {
      throw new Error('.harness/project-details.json não encontrado. Rode: npx @ai-harness/cli init')
    }),
  ])

  const config: HarnessConfig = JSON.parse(configRaw)
  const project: ProjectDetails = JSON.parse(projectRaw)

  validate(config, project)

  return { config, project }
}

function validateRelativePath(raw: string, field: string): void {
  const s = raw.trim().replace(/\/+$/, '')
  if (!s) {
    throw new Error(`harness.config.json: ${field} não pode ser vazio`)
  }
  if (s.startsWith('/')) {
    throw new Error(`harness.config.json: ${field} deve ser relativo à raiz do projeto (sem / inicial)`)
  }
  if (s.split('/').includes('..')) {
    throw new Error(`harness.config.json: ${field} não pode conter ".."`)
  }
}

function validateRegistryConfig(registry: RegistryConfig | undefined): void {
  if (!registry) return

  if (registry.skills_base_url) {
    validateRegistryUrl(registry.skills_base_url, 'registry.skills_base_url')
  }
  if (registry.rules_base_url) {
    validateRegistryUrl(registry.rules_base_url, 'registry.rules_base_url')
  }
  if (registry.manifest_url) {
    validateRegistryUrl(registry.manifest_url, 'registry.manifest_url')
  }

  for (const [scope, cfg] of Object.entries(registry.scopes ?? {})) {
    if (cfg.skills_base_url) {
      validateRegistryUrl(cfg.skills_base_url, `registry.scopes.${scope}.skills_base_url`)
    }
    if (cfg.rules_base_url) {
      validateRegistryUrl(cfg.rules_base_url, `registry.scopes.${scope}.rules_base_url`)
    }
  }
}

function validateRegistryUrl(url: string, field: string): void {
  if (!/^https?:\/\//i.test(url.trim())) {
    throw new Error(`harness.config.json: ${field} deve ser uma URL http(s)`)
  }
}

function validateSkillsConfig(config: HarnessConfig): void {
  const skills = config.skills
  if (!skills) return

  if (typeof skills.source !== 'string' || !skills.source.trim()) {
    throw new Error('harness.config.json: skills.source deve ser uma string não-vazia')
  }
  validateRelativePath(skills.source, 'skills.source')

  if (!Array.isArray(skills.targets)) {
    throw new Error('harness.config.json: skills.targets deve ser um array')
  }
  if (skills.targets.length === 0) {
    throw new Error('harness.config.json: skills.targets não pode ser vazio')
  }
  for (const [i, target] of skills.targets.entries()) {
    if (typeof target !== 'string') {
      throw new Error(`harness.config.json: skills.targets[${i}] deve ser uma string`)
    }
    validateRelativePath(target, `skills.targets[${i}]`)
  }
}

function validate(config: HarnessConfig, project: ProjectDetails): void {
  if (!config.tools) {
    throw new Error('harness.config.json: campo "tools" ausente')
  }
  if (!project.commands) {
    throw new Error('project-details.json: campo "commands" ausente')
  }

  const cursor = config.tools.cursor
  if (cursor && cursor.agent_skills_mirror_root !== undefined) {
    if (typeof cursor.agent_skills_mirror_root !== 'string') {
      throw new Error('harness.config.json: tools.cursor.agent_skills_mirror_root deve ser uma string')
    }
    validateRelativePath(cursor.agent_skills_mirror_root, 'tools.cursor.agent_skills_mirror_root')
  }

  const copilot = config.tools.copilot
  if (copilot && copilot.copilot_mirror_root !== undefined) {
    if (typeof copilot.copilot_mirror_root !== 'string') {
      throw new Error('harness.config.json: tools.copilot.copilot_mirror_root deve ser uma string')
    }
    validateRelativePath(copilot.copilot_mirror_root, 'tools.copilot.copilot_mirror_root')
  }

  validateSkillsConfig(config)
  validateEvolutionConfig(config)
  validateRegistryConfig(config.registry)

  const required = ['lint', 'typecheck', 'test', 'build'] as const
  for (const cmd of required) {
    if (!project.commands[cmd]) {
      console.warn(`⚠️  project-details.json: comando "${cmd}" não definido`)
    }
  }
}
