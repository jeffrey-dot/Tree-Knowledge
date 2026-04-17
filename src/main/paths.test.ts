import { describe, expect, it } from 'vitest'
import { getPreloadEntry, getRendererTarget } from './paths'

describe('main path resolution', () => {
  it('uses the dev server when one is configured', () => {
    expect(getRendererTarget('/app/dist-electron', 'http://localhost:5173')).toEqual({
      kind: 'url',
      value: 'http://localhost:5173',
    })
  })

  it('falls back to the bundled renderer in production', () => {
    expect(getRendererTarget('/app/dist-electron')).toEqual({
      kind: 'file',
      value: '/app/dist/index.html',
    })
  })

  it('resolves the preload bundle relative to the built main process', () => {
    expect(getPreloadEntry('/app/dist-electron')).toBe('/app/dist-electron/index.js')
  })
})
