import { describe, expect, it } from 'vitest'

import { decodeDocImportPreview } from './preview'

const preview = {
  conflicts: [],
  counts: { assets: 0, groups: 1, links: 0, pages: 1, tabs: 1 },
  badSmells: [],
  expiresAt: '2026-07-21T11:00:00Z',
  previewRef: 'prv_01JXYZ',
  schemaVersion: 1,
  sourceInfo: {
    branch: 'main',
    commit: 'a'.repeat(40),
    configPaths: ['docs/.vitepress/config.ts'],
    contentRoot: 'docs',
    framework: 'vitepress',
    repo: 'acme/docs',
    repoUrl: 'https://github.com/acme/docs',
  },
  targetRevision: 'preview:absent:0',
  targetTree: { tabs: [] },
  tree: {
    navigation: [],
    schemaVersion: 2,
    source: {
      configPaths: ['docs/.vitepress/config.ts'],
      framework: 'vitepress',
      root: 'docs',
    },
  },
}

describe('decodeDocImportPreview', () => {
  it('keeps the temporary preview contract independent of a persistent job', () => {
    const decoded = decodeDocImportPreview(preview)

    expect(decoded.previewRef).toBe('prv_01JXYZ')
    expect(decoded).not.toHaveProperty('jobRef')
    expect(decoded).not.toHaveProperty('id')
  })

  it('rejects unbounded or incomplete count fields', () => {
    expect(() =>
      decodeDocImportPreview({ ...preview, counts: { ...preview.counts, pages: -1 } }),
    ).toThrow('preview.counts.pages')
  })

  it('bounds SourceTree work when decoding a stored preview artifact', () => {
    const navigation = Array.from({ length: 6_001 }, (_, index) => ({
      href: `https://example.com/${index}`,
      type: 'link',
      sourceId: `link-${index}`,
      title: `Link ${index}`,
    }))

    expect(() =>
      decodeDocImportPreview({ ...preview, tree: { ...preview.tree, navigation } }),
    ).toThrow('exceeds 6000 nodes')
  })
})
