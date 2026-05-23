import { cp, lstat, mkdir, rm, symlink, unlink } from 'fs/promises'
import { dirname, relative, resolve } from 'path'

export type LinkStrategy = 'symlink' | 'copy'

export interface SkillsLinkResult {
  target: string
  strategy: LinkStrategy
  action: 'created' | 'replaced' | 'dry-run'
}

/**
 * Detects the best link strategy for the current platform.
 * - Linux, macOS, WSL → symlink (zero maintenance, always in sync)
 * - Windows native    → copy   (symlinks require admin / Developer Mode)
 */
export function detectStrategy(): LinkStrategy {
  const isWindows = process.platform === 'win32'
  const isWsl = !!process.env.WSL_DISTRO_NAME
  return isWindows && !isWsl ? 'copy' : 'symlink'
}

/**
 * Links (or copies) the skills source directory to each target path.
 * Each target becomes either a symlink pointing to `source` (Linux/Mac/WSL)
 * or a full directory copy (Windows native).
 *
 * Idempotent: existing symlinks and directories at target paths are replaced.
 */
export async function linkSkills(opts: {
  projectRoot: string
  /** Relative to projectRoot — e.g. '.harness/skills' */
  source: string
  /** Relative to projectRoot — e.g. ['.claude/skills', '.cursor/skills'] */
  targets: string[]
  dryRun: boolean
  strategy?: LinkStrategy
}): Promise<SkillsLinkResult[]> {
  const { projectRoot, source, targets, dryRun } = opts
  const strategy = opts.strategy ?? detectStrategy()
  const sourceAbs = resolve(projectRoot, source)
  const results: SkillsLinkResult[] = []

  for (const target of targets) {
    const targetAbs = resolve(projectRoot, target)

    if (dryRun) {
      results.push({ target: targetAbs, strategy, action: 'dry-run' })
      continue
    }

    let action: SkillsLinkResult['action'] = 'created'

    // Remove existing target if present (symlink, dir, or file)
    try {
      const st = await lstat(targetAbs)
      action = 'replaced'
      if (st.isSymbolicLink()) {
        await unlink(targetAbs)
      } else if (st.isDirectory()) {
        await rm(targetAbs, { recursive: true, force: true })
      } else {
        await unlink(targetAbs)
      }
    } catch {
      // target doesn't exist — that's fine
    }

    await mkdir(dirname(targetAbs), { recursive: true })

    if (strategy === 'symlink') {
      // Relative symlink so the project is portable
      const relPath = relative(dirname(targetAbs), sourceAbs)
      await symlink(relPath, targetAbs, 'dir')
    } else {
      await cp(sourceAbs, targetAbs, { recursive: true })
    }

    results.push({ target: targetAbs, strategy, action })
  }

  return results
}
