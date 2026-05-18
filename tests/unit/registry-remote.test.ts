import { describe, expect, it } from 'vitest'
import {
    compareSemver,
    parsePackageRef,
    resolveRulePackUrl,
    resolveSkillUrl,
    type RegistryConfig,
} from '../../src/registry-remote.js'

const defaults: RegistryConfig = {
  skills_base_url: 'https://example.com/official/skills',
  rules_base_url: 'https://example.com/official/rules',
  scopes: {
    myorg: {
      skills_base_url: 'https://example.com/myorg/skills',
      rules_base_url: 'https://example.com/myorg/rules',
    },
  },
}

describe('parsePackageRef', () => {
  it('parses plain skill name', () => {
    expect(parsePackageRef('nestjs')).toEqual({ scope: null, name: 'nestjs', raw: 'nestjs' })
  })

  it('parses scoped ref @org/name', () => {
    expect(parsePackageRef('@myorg/payroll')).toEqual({
      scope: 'myorg',
      name: 'payroll',
      raw: '@myorg/payroll',
    })
  })

  it('rejects invalid scoped ref', () => {
    expect(() => parsePackageRef('@invalid')).toThrow()
  })
})

describe('resolveSkillUrl', () => {
  it('resolves official skill from skills_base_url', () => {
    expect(resolveSkillUrl('nestjs', defaults)).toBe(
      'https://example.com/official/skills/nestjs/SKILL.md',
    )
  })

  it('resolves scoped skill from scopes config', () => {
    expect(resolveSkillUrl('@myorg/payroll', defaults)).toBe(
      'https://example.com/myorg/skills/payroll/SKILL.md',
    )
  })

  it('throws when scoped scope is not configured', () => {
    expect(() => resolveSkillUrl('@unknown/foo', defaults)).toThrow('scope')
  })

  it('accepts absolute URL as-is', () => {
    const url = 'https://cdn.example.com/custom/SKILL.md'
    expect(resolveSkillUrl(url, defaults)).toBe(url)
  })
})

describe('resolveRulePackUrl', () => {
  it('resolves official rule pack', () => {
    expect(resolveRulePackUrl('typescript', defaults)).toBe(
      'https://example.com/official/rules/typescript.md',
    )
  })

  it('resolves scoped rule pack', () => {
    expect(resolveRulePackUrl('@myorg/security', defaults)).toBe(
      'https://example.com/myorg/rules/security.md',
    )
  })
})

describe('compareSemver', () => {
  it('detects same version', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toEqual({ kind: 'same', breaking: false })
  })

  it('detects patch update', () => {
    expect(compareSemver('1.2.3', '1.2.4')).toEqual({ kind: 'patch', breaking: false })
  })

  it('detects minor update', () => {
    expect(compareSemver('1.2.3', '1.3.0')).toEqual({ kind: 'minor', breaking: false })
  })

  it('detects major breaking update', () => {
    expect(compareSemver('1.2.3', '2.0.0')).toEqual({ kind: 'major', breaking: true })
  })

  it('treats missing local version as safe update', () => {
    expect(compareSemver(null, '2.0.0')).toEqual({ kind: 'unknown', breaking: false })
  })
})
