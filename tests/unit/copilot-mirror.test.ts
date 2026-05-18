import { describe, expect, it } from 'vitest'
import {
    buildCopilotHooksIndex,
    buildCopilotSkillsIndex,
} from '../../src/adapters/copilot-mirror.js'
import type { HookMeta, SkillMeta } from '../../src/types.js'

describe('copilot-mirror indexes', () => {
  it('buildCopilotSkillsIndex lists mirror paths', () => {
    const skills: SkillMeta[] = [
      {
        name: 'nestjs',
        domain: 'backend',
        weight: 800,
        globs: ['**/*.service.ts'],
        exposes_command: [],
        required_by: [],
        load_with: [],
        conflicts_with: [],
        source: null,
        sync: true,
      },
    ]
    const md = buildCopilotSkillsIndex('.github/harness', skills)
    expect(md).toContain('nestjs')
    expect(md).toContain('.github/harness/skills/nestjs.md')
  })

  it('buildCopilotHooksIndex lists hook paths', () => {
    const hooks: HookMeta[] = [
      {
        name: 'pre-task',
        file: 'pre-task.md',
        triggers: 'start',
        blocks: true,
        weight: 300,
        always_load: true,
      },
    ]
    const md = buildCopilotHooksIndex('.github/harness', hooks)
    expect(md).toContain('pre-task')
    expect(md).toContain('.github/harness/hooks/pre-task.md')
  })
})
