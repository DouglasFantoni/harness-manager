import { describe, expect, it } from 'vitest'
import {
    buildHarnessHooksFromRegistry,
    buildHarnessPromptHook,
    HARNESS_HOOK_CURSOR_MAP,
    mergeCursorHooksFile,
} from '../../src/adapters/cursor-hooks.js'
import type { HookMeta } from '../../src/types.js'

const hooks: HookMeta[] = [
  {
    name: 'pre-task',
    file: 'pre-task.md',
    triggers: 'start',
    blocks: true,
    weight: 300,
    always_load: true,
  },
  {
    name: 'on-error',
    file: 'on-error.md',
    triggers: 'error',
    blocks: true,
    weight: 250,
    always_load: true,
  },
]

describe('cursor-hooks', () => {
  it('maps known harness hooks to Cursor events', () => {
    expect(HARNESS_HOOK_CURSOR_MAP['pre-task']).toEqual([{ event: 'beforeSubmitPrompt' }])
    expect(HARNESS_HOOK_CURSOR_MAP['on-error']).toEqual([{ event: 'postToolUseFailure' }])
  })

  it('buildHarnessPromptHook tags _harness and includes body', () => {
    const def = buildHarnessPromptHook('pre-task', '- [ ] Scope clear?')
    expect(def._harness).toBe('pre-task')
    expect(def.type).toBe('prompt')
    expect(def.prompt).toContain('pre-task')
    expect(def.prompt).toContain('Scope clear?')
    expect(def.prompt).toContain('$ARGUMENTS')
  })

  it('buildHarnessHooksFromRegistry creates prompt hooks per event', () => {
    const bodies = new Map([
      ['pre-task', 'Checklist A'],
      ['on-error', 'Checklist B'],
    ])
    const file = buildHarnessHooksFromRegistry(hooks, bodies)
    expect(file.version).toBe(1)
    expect(file.hooks.beforeSubmitPrompt?.length).toBe(1)
    expect(file.hooks.postToolUseFailure?.length).toBe(1)
    expect(file.hooks.beforeSubmitPrompt?.[0]._harness).toBe('pre-task')
  })

  it('mergeCursorHooksFile preserves non-harness hooks', () => {
    const existing = {
      version: 1,
      hooks: {
        afterFileEdit: [{ command: '.cursor/hooks/format.sh' } as never],
        beforeSubmitPrompt: [
          {
            type: 'prompt' as const,
            prompt: 'custom',
            timeout: 5,
            _harness: 'pre-task',
          },
        ],
      },
    }
    const harness = buildHarnessHooksFromRegistry(
      hooks,
      new Map([
        ['pre-task', 'New checklist'],
        ['on-error', 'Error policy'],
      ]),
    )
    const merged = mergeCursorHooksFile(existing, harness)
    expect(merged.hooks.afterFileEdit).toHaveLength(1)
    expect(merged.hooks.beforeSubmitPrompt?.some(h => h._harness === 'pre-task')).toBe(true)
    expect(merged.hooks.beforeSubmitPrompt?.find(h => h._harness === 'pre-task')?.prompt).toContain(
      'New checklist',
    )
  })
})
