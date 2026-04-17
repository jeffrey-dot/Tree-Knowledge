import { join } from 'node:path'

export function getPreloadEntry(baseDir: string) {
  return join(baseDir, '../dist-electron/index.js')
}

export function getRendererTarget(baseDir: string, devServerUrl?: string) {
  if (devServerUrl) {
    return {
      kind: 'url' as const,
      value: devServerUrl,
    }
  }

  return {
    kind: 'file' as const,
    value: join(baseDir, '../dist/index.html'),
  }
}
