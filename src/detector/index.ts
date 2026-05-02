import { readFile, access, readdir } from 'fs/promises'
import { resolve, join, basename } from 'path'
import type { ProjectDetails } from '../types.js'

// getRoot() é resolvido em runtime para permitir mocking em testes
function getRoot() { return process.cwd() }

// Helper: (condition && value) retorna false | string — filter tipado resolve
function pick(condition: boolean, value: string): string | undefined {
  return condition ? value : undefined
}


export interface DetectionResult {
  details: ProjectDetails
  reviewHints: string[]
}

export async function detectProject(): Promise<DetectionResult> {
  const rootPkg = await readJsonSafe('package.json')
  const isMonorepo = await detectMonorepo(rootPkg)
  const stack = await detectStack(rootPkg)
  const structure = await detectStructure(rootPkg, isMonorepo)
  const commands = detectCommands(rootPkg)
  const conventions = await detectConventions()

  const details: ProjectDetails = {
    project: {
      name: (rootPkg?.name as string | undefined) ?? basename(getRoot()),
      description: (rootPkg?.description as string | undefined) ?? '',
      type: isMonorepo ? 'monorepo' : 'single',
      stack,
    },
    structure,
    commands,
    conventions,
    context_hints: {
      entry_points: await detectEntryPoints(structure),
      avoid_paths: defaultAvoidPaths(),
      critical_files: [],
    },
  }

  return {
    details,
    reviewHints: buildReviewHints(details),
  }
}

// ─── Stack ────────────────────────────────────────────────────────────────────

async function detectStack(pkg: Record<string, unknown> | null) {
  const deps = {
    ...((pkg?.dependencies ?? {}) as Record<string, string>),
    ...((pkg?.devDependencies ?? {}) as Record<string, string>),
  }
  const has = (dep: string) => dep in deps

  return {
    backend: [
      pick(has('@nestjs/core'), 'nestjs'),
      pick(has('express'), 'express'),
      pick(has('fastify'), 'fastify'),
      pick(has('typeorm'), 'typeorm'),
      pick(has('@prisma/client'), 'prisma'),
      pick(has('typescript'), 'typescript'),
    ].filter(Boolean) as string[],

    frontend: [
      pick(has('next'), 'nextjs'),
      pick(has('react'), 'react'),
      pick(has('vue'), 'vue'),
      pick(has('@remix-run/react'), 'remix'),
      pick(has('@radix-ui/react-dialog'), 'radix-ui'),
      pick(has('tailwindcss'), 'tailwindcss'),
    ].filter(Boolean) as string[],

    infra: [
      pick(await fileExists('docker-compose.yml') || await fileExists('Dockerfile'), 'docker'),
      pick(await fileExists('.github/workflows'), 'github-actions'),
      pick(await fileExists('turbo.json'), 'turborepo'),
      pick(await fileExists('nx.json'), 'nx'),
    ].filter(Boolean) as string[],
  }
}

// ─── Monorepo ─────────────────────────────────────────────────────────────────

async function detectMonorepo(pkg: Record<string, unknown> | null): Promise<boolean> {
  if (pkg?.workspaces) return true
  if (await fileExists('pnpm-workspace.yaml')) return true
  if (await fileExists('turbo.json')) return true
  if (await fileExists('nx.json')) return true
  return false
}

// ─── Structure ────────────────────────────────────────────────────────────────

async function detectStructure(
  pkg: Record<string, unknown> | null,
  isMonorepo: boolean,
): Promise<ProjectDetails['structure']> {
  if (!isMonorepo) {
    return { root: '.', apps: ['.'], packages: [], shared: [] }
  }

  let workspaceGlobs: string[] = (
    (pkg?.workspaces as string[]) ?? []
  ).map(g => g.replace(/\/\*\*?$/, ''))  // normaliza "apps/*" -> "apps"

  if (!workspaceGlobs.length && await fileExists('pnpm-workspace.yaml')) {
    const raw = await readFile(resolve(getRoot(), 'pnpm-workspace.yaml'), 'utf-8')
    const match = raw.match(/packages:\s*([\s\S]*?)(?=\n\w|$)/)
    if (match) {
      workspaceGlobs = match[1]
        .trim()
        .split('\n')
        .map(l => l.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, '').replace(/\/\*$/, ''))
        .filter(Boolean)
    }
  }

  const apps: string[] = []
  const packages: string[] = []

  for (const glob of workspaceGlobs) {
    const dir = resolve(getRoot(), glob)
    const children = await readdirSafe(dir)

    for (const child of children) {
      const fullPath = join(glob, child)
      if (!(await fileExists(join(fullPath, 'package.json')))) continue
      if (glob.includes('app')) apps.push(fullPath)
      else packages.push(fullPath)
    }
  }

  return { root: '.', apps, packages, shared: packages }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function detectCommands(pkg: Record<string, unknown> | null): ProjectDetails['commands'] {
  const scripts = (pkg?.scripts ?? {}) as Record<string, string>
  const pm = detectPackageManager()
  const find = (...keys: string[]) => {
    const key = keys.find(k => k in scripts)
    return key ? `${pm} ${key}` : ''
  }

  return {
    lint: find('lint'),
    test: find('test'),
    typecheck: find('typecheck', 'type-check', 'tsc'),
    build: find('build'),
    dev: find('dev', 'start:dev', 'start'),
    custom: {},
  }
}

import { existsSync } from 'fs'

function detectPackageManager(): string {
  if (existsSync(resolve(getRoot(), 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(resolve(getRoot(), 'yarn.lock'))) return 'yarn'
  return 'npm run'
}

// ─── Conventions ──────────────────────────────────────────────────────────────

async function detectConventions(): Promise<ProjectDetails['conventions']> {
  const hasCommitlint =
    await fileExists('.commitlintrc') ||
    await fileExists('.commitlintrc.json') ||
    await fileExists('commitlint.config.js') ||
    await fileExists('commitlint.config.ts')

  const prTemplate = await fileExists('.github/pull_request_template.md')
    ? '.github/pull_request_template.md'
    : ''

  return {
    branch_pattern: '',
    commit_pattern: hasCommitlint ? 'conventional-commits' : '',
    pr_template: prTemplate,
  }
}

// ─── Entry points ─────────────────────────────────────────────────────────────

async function detectEntryPoints(structure: ProjectDetails['structure']): Promise<string[]> {
  const candidates = [
    'src/main.ts', 'src/index.ts',
    'src/app/layout.tsx', 'src/app/page.tsx',
    'app/layout.tsx', 'app/page.tsx',
  ]

  const found: string[] = []
  const dirs = [...structure.apps, ...structure.packages]

  for (const dir of dirs) {
    for (const candidate of candidates) {
      if (await fileExists(join(dir, candidate))) {
        found.push(join(dir, candidate))
      }
    }
  }

  return found
}

// ─── Review hints ─────────────────────────────────────────────────────────────

function buildReviewHints(details: ProjectDetails): string[] {
  const hints: string[] = []

  if (!details.project.description) {
    hints.push('Preencha "project.description"')
  }
  if (!details.context_hints.critical_files.length) {
    hints.push('Preencha "context_hints.critical_files" com os arquivos mais importantes')
  }
  if (!details.conventions.branch_pattern) {
    hints.push('Defina "conventions.branch_pattern" (ex: "feat|fix|chore/{ticket}-{desc}")')
  }
  if (!details.commands.typecheck) {
    hints.push('Verifique "commands.typecheck" — não foi detectado automaticamente')
  }

  hints.push('Confirme se todos os comandos estão corretos')
  hints.push('Remova entradas de stack que foram detectadas incorretamente')

  return hints
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(resolve(getRoot(), path), 'utf-8'))
  } catch {
    return null
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(resolve(getRoot(), path))
    return true
  } catch {
    return false
  }
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
}

function defaultAvoidPaths(): string[] {
  return ['dist/', '.next/', 'node_modules/', 'coverage/', '.turbo/', 'build/']
}
