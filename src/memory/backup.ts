import { copyFile } from 'fs/promises'
import { resolve } from 'path'
import type { MemoryFilePath } from './status.js'

function harnessRoot() {
  return resolve(process.cwd(), '.harness')
}

/** Creates `.bak.md` siblings for memory files before applying AI-condensed versions. */
export async function backupMemoryFiles(paths: MemoryFilePath[]): Promise<string[]> {
  const created: string[] = []

  for (const relativePath of paths) {
    const src = resolve(harnessRoot(), relativePath)
    const dest = src.replace(/\.md$/, '.bak.md')
    await copyFile(src, dest)
    created.push(dest)
  }

  return created
}
