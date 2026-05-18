import { mkdir, readFile, writeFile } from 'fs/promises'
import matter from 'gray-matter'
import { resolve } from 'path'
import type { HookMeta } from '../types.js'

/** Harness hook name → Cursor hook events (prompt-based bridge). */
export const HARNESS_HOOK_CURSOR_MAP: Record<
  string,
  Array<{ event: string; matcher?: string; failClosed?: boolean }>
> = {
  'pre-task': [{ event: 'beforeSubmitPrompt' }],
  'on-ambiguity': [{ event: 'beforeSubmitPrompt' }],
  'on-error': [{ event: 'postToolUseFailure' }],
  'post-task': [{ event: 'stop' }],
  'on-skill-load': [{ event: 'preToolUse', matcher: 'Read' }],
  'on-command': [{ event: 'beforeSubmitPrompt', matcher: '/\\w+' }],
}

const PROMPT_MAX_CHARS = 2400

export interface CursorHookDefinition {
  type: 'prompt'
  prompt: string
  timeout: number
  matcher?: string
  failClosed?: boolean
  _harness: string
}

export interface CursorHooksFile {
  version: number
  hooks: Record<string, CursorHookDefinition[]>
}

export async function readHarnessHookBody(
  harnessRoot: string,
  hook: HookMeta,
): Promise<string | null> {
  const raw = await readFile(resolve(harnessRoot, 'hooks', hook.file), 'utf-8').catch(() => null)
  if (!raw) return null
  const { content } = matter(raw)
  return content.trim()
}

export function buildHarnessPromptHook(
  hookName: string,
  body: string,
  opts?: { matcher?: string; failClosed?: boolean },
): CursorHookDefinition {
  const trimmed =
    body.length > PROMPT_MAX_CHARS
      ? `${body.slice(0, PROMPT_MAX_CHARS)}\n\n…(truncated — full text in .harness/hooks/${hookName}.md)`
      : body

  const prompt = [
    `You are enforcing the Harness hook "${hookName}" (source: .harness/hooks/${hookName}.md).`,
    'Apply this checklist/policy to the current agent step. If the hook blocks and requirements are not met, ask the user or stop before proceeding.',
    '',
    trimmed,
    '',
    'Hook input context: $ARGUMENTS',
  ].join('\n')

  return {
    type: 'prompt',
    prompt,
    timeout: 20,
    ...(opts?.matcher ? { matcher: opts.matcher } : {}),
    ...(opts?.failClosed ? { failClosed: opts.failClosed } : {}),
    _harness: hookName,
  }
}

export function buildHarnessHooksFromRegistry(
  hooks: HookMeta[],
  bodies: Map<string, string>,
): CursorHooksFile {
  const result: CursorHooksFile = { version: 1, hooks: {} }

  for (const hook of hooks) {
    const mappings = HARNESS_HOOK_CURSOR_MAP[hook.name]
    const body = bodies.get(hook.name)
    if (!mappings?.length || !body) continue

    for (const { event, matcher, failClosed } of mappings) {
      const def = buildHarnessPromptHook(hook.name, body, {
        matcher,
        failClosed: failClosed ?? hook.blocks,
      })
      if (!result.hooks[event]) result.hooks[event] = []
      result.hooks[event].push(def)
    }
  }

  return result
}

export function mergeCursorHooksFile(
  existing: CursorHooksFile | null,
  harness: CursorHooksFile,
): CursorHooksFile {
  const merged: CursorHooksFile = {
    version: existing?.version ?? harness.version,
    hooks: { ...(existing?.hooks ?? {}) },
  }

  for (const [event, defs] of Object.entries(harness.hooks)) {
    const kept = (merged.hooks[event] ?? []).filter(
      d => !('_harness' in d && (d as CursorHookDefinition)._harness),
    )
    merged.hooks[event] = [...kept, ...defs]
  }

  return merged
}

export async function generateCursorHooks(opts: {
  projectRoot: string
  harnessHooks: HookMeta[]
  dryRun: boolean
}): Promise<string[]> {
  const harnessRoot = resolve(opts.projectRoot, '.harness')
  const hooksJsonPath = resolve(opts.projectRoot, '.cursor/hooks.json')
  const promptsDir = resolve(opts.projectRoot, '.cursor/hooks/harness')
  const outFiles: string[] = [hooksJsonPath]

  const bodies = new Map<string, string>()
  for (const hook of opts.harnessHooks) {
    const body = await readHarnessHookBody(harnessRoot, hook)
    if (body) bodies.set(hook.name, body)
  }

  const harnessHooks = buildHarnessHooksFromRegistry(opts.harnessHooks, bodies)

  let existing: CursorHooksFile | null = null
  try {
    const raw = await readFile(hooksJsonPath, 'utf-8')
    existing = JSON.parse(raw) as CursorHooksFile
  } catch {
    /* no existing hooks.json */
  }

  const merged = mergeCursorHooksFile(existing, harnessHooks)

  if (!opts.dryRun) {
    await mkdir(resolve(hooksJsonPath, '..'), { recursive: true })
    await mkdir(promptsDir, { recursive: true })

    for (const [name, body] of bodies) {
      const promptPath = resolve(promptsDir, `${name}.md`)
      const doc = `# Harness hook: ${name}\n\n> Mirror for debugging. Canonical source: \`.harness/hooks/${name}.md\`\n\n${body}\n`
      await writeFile(promptPath, doc, 'utf-8')
      outFiles.push(promptPath)
    }

    await writeFile(hooksJsonPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

    const readmePath = resolve(opts.projectRoot, '.cursor/hooks/README.md')
    await writeFile(
      readmePath,
      [
        '# Cursor hooks (Harness)',
        '',
        '`hooks.json` includes prompt hooks generated from `.harness/hooks/*.md`.',
        'Entries tagged with `_harness` are replaced on each `harness sync`.',
        'Other entries in `hooks.json` are preserved.',
        '',
        'See also `.harness/hooks/_index.md` and `MCP-RECOMMENDED.md` for MCP setup.',
        '',
      ].join('\n'),
      'utf-8',
    )
    outFiles.push(readmePath)
  }

  return outFiles
}
