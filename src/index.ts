// Public API — para quem importar @ai-harness/cli como lib
export { runSync } from './sync.js'
export { runInit } from './commands/init.js'
export type {
  HarnessConfig,
  ProjectDetails,
  ToolConfig,
  Registry,
  SyncFlags,
  AdapterResult,
} from './types.js'
