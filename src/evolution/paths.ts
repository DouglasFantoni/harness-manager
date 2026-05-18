import { resolve } from 'path'

export function getProjectRoot(): string {
  return process.cwd()
}

export function getHarnessRoot(): string {
  return resolve(getProjectRoot(), '.harness')
}

export function feedbackPath(): string {
  return resolve(getHarnessRoot(), 'evolution/feedback.md')
}

export function metricsPath(): string {
  return resolve(getHarnessRoot(), 'evolution/metrics.md')
}

export function proposedDir(): string {
  return resolve(getHarnessRoot(), 'evolution/proposed')
}

export function configPath(): string {
  return resolve(getHarnessRoot(), 'harness.config.json')
}
