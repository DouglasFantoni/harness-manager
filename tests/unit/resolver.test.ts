import { describe, it, expect } from 'vitest'
import { resolvePlaceholders } from '../../src/resolver.js'
import type { ProjectDetails } from '../../src/types.js'

const baseProject: ProjectDetails = {
  project: {
    name: 'test-project',
    description: 'A test project',
    type: 'single',
    stack: { backend: ['nestjs'], frontend: ['nextjs'], infra: ['docker'] },
  },
  structure: { root: '.', apps: ['apps/api'], packages: [], shared: [] },
  commands: {
    lint: 'pnpm lint',
    test: 'pnpm test',
    typecheck: 'pnpm typecheck',
    build: 'pnpm build',
    dev: 'pnpm dev',
    custom: { 'test:coverage': 'pnpm test --coverage' },
  },
  conventions: {
    branch_pattern: 'feat|fix/{ticket}',
    commit_pattern: 'conventional-commits',
    pr_template: '.github/pull_request_template.md',
  },
  context_hints: {
    entry_points: ['src/main.ts'],
    avoid_paths: ['dist/', 'node_modules/'],
    critical_files: ['src/app.module.ts'],
  },
}

describe('resolvePlaceholders', () => {
  describe('basic resolution', () => {
    it('resolve placeholder simples', () => {
      const result = resolvePlaceholders('Run: {{commands.lint}}', baseProject)
      expect(result).toBe('Run: pnpm lint')
    })

    it('resolve múltiplos placeholders na mesma string', () => {
      const result = resolvePlaceholders(
        '{{commands.typecheck}} && {{commands.lint}} && {{commands.test}}',
        baseProject,
      )
      expect(result).toBe('pnpm typecheck && pnpm lint && pnpm test')
    })

    it('resolve placeholder de nível 1 (project.name)', () => {
      const result = resolvePlaceholders('Projeto: {{project.name}}', baseProject)
      expect(result).toBe('Projeto: test-project')
    })

    it('resolve placeholder de nível 3 aninhado', () => {
      const result = resolvePlaceholders('Backend: {{project.stack.backend}}', baseProject)
      expect(result).toBe('Backend: nestjs')
    })

    it('converte array em string separada por vírgula', () => {
      const multi = {
        ...baseProject,
        project: {
          ...baseProject.project,
          stack: { backend: ['nestjs', 'typeorm', 'typescript'], frontend: [], infra: [] },
        },
      }
      const result = resolvePlaceholders('Stack: {{project.stack.backend}}', multi)
      expect(result).toBe('Stack: nestjs, typeorm, typescript')
    })

    it('resolve placeholder em múltiplas linhas', () => {
      const template = `
# Projeto: {{project.name}}
Lint: {{commands.lint}}
Test: {{commands.test}}
`.trim()
      const result = resolvePlaceholders(template, baseProject)
      expect(result).toBe('# Projeto: test-project\nLint: pnpm lint\nTest: pnpm test')
    })
  })

  describe('edge cases — placeholder não encontrado', () => {
    it('mantém placeholder original quando caminho não existe', () => {
      const result = resolvePlaceholders('{{commands.nonexistent}}', baseProject)
      expect(result).toBe('{{commands.nonexistent}}')
    })

    it('mantém placeholder quando nó intermediário não existe', () => {
      const result = resolvePlaceholders('{{foo.bar.baz}}', baseProject)
      expect(result).toBe('{{foo.bar.baz}}')
    })

    it('mantém placeholder quando valor é undefined explícito', () => {
      const project = {
        ...baseProject,
        commands: { ...baseProject.commands, lint: undefined as unknown as string },
      }
      const result = resolvePlaceholders('{{commands.lint}}', project)
      expect(result).toBe('{{commands.lint}}')
    })
  })

  describe('edge cases — strings especiais', () => {
    it('string vazia retorna string vazia', () => {
      expect(resolvePlaceholders('', baseProject)).toBe('')
    })

    it('string sem placeholder retorna igual', () => {
      const input = 'Nenhum placeholder aqui'
      expect(resolvePlaceholders(input, baseProject)).toBe(input)
    })

    it('placeholder incompleto não é resolvido', () => {
      expect(resolvePlaceholders('{{commands.lint}', baseProject)).toBe('{{commands.lint}')
      expect(resolvePlaceholders('{commands.lint}}', baseProject)).toBe('{commands.lint}}')
    })

    it('placeholder vazio não causa crash', () => {
      const result = resolvePlaceholders('{{}}', baseProject)
      expect(result).toBe('{{}}')
    })

    it('placeholder com espaços é resolvido (trim)', () => {
      const result = resolvePlaceholders('{{ commands.lint }}', baseProject)
      expect(result).toBe('pnpm lint')
    })

    it('valores numéricos são convertidos para string', () => {
      const project = {
        ...baseProject,
        project: { ...baseProject.project, name: 42 as unknown as string },
      }
      const result = resolvePlaceholders('{{project.name}}', project)
      expect(result).toBe('42')
    })

    it('múltiplos placeholders idênticos são todos resolvidos', () => {
      const result = resolvePlaceholders(
        '{{commands.lint}} {{commands.lint}} {{commands.lint}}',
        baseProject,
      )
      expect(result).toBe('pnpm lint pnpm lint pnpm lint')
    })
  })
})
