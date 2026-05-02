#!/usr/bin/env node
// Post-build: garante que dist/cli.js tem shebang e permissão de execução
// O tsc não preserva o shebang do arquivo fonte

import { readFile, writeFile, chmod } from 'fs/promises'
import { resolve } from 'path'

const cliPath = resolve(process.cwd(), 'dist/cli.js')

const content = await readFile(cliPath, 'utf-8')

if (!content.startsWith('#!/usr/bin/env node')) {
  await writeFile(cliPath, `#!/usr/bin/env node\n${content}`, 'utf-8')
  console.log('✅ postbuild: shebang adicionado em dist/cli.js')
}

await chmod(cliPath, 0o755)
console.log('✅ postbuild: dist/cli.js está executável')
