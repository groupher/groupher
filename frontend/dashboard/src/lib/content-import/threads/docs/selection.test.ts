import { describe, expect, it } from 'vitest'

import { SOURCE_ANALYSIS_SCHEMA_VERSION, type TSourceAnalysis } from './contracts'
import { selectSourceAnalysis } from './selection'

const analysis: TSourceAnalysis = {
  badSmells: [],
  documents: [
    {
      contentHash: 'a',
      route: '/a',
      sizeBytes: 1,
      sourceRef: 'docs/a.md',
      title: 'A',
      titleSource: 'heading',
    },
    {
      contentHash: 'b',
      route: '/b',
      sizeBytes: 1,
      sourceRef: 'docs/b.md',
      title: 'B',
      titleSource: 'metadata',
    },
  ],
  schemaVersion: SOURCE_ANALYSIS_SCHEMA_VERSION,
  tree: {
    navigation: [
      {
        pages: [
          {
            pages: [
              {
                type: 'page',
                route: '/a',
                sourceId: 'docs/a.md',
                sourcePath: 'docs/a.md',
                title: 'A',
              },
              {
                type: 'page',
                route: '/b',
                sourceId: 'docs/b.md',
                sourcePath: 'docs/b.md',
                title: 'B',
              },
              {
                href: 'https://example.com',
                type: 'link',
                sourceId: 'external',
                title: 'External',
              },
            ],
            type: 'section',
            sourceId: 'section:guides',
            title: 'Guides',
          },
          {
            pages: [
              {
                href: 'https://empty.example',
                type: 'link',
                sourceId: 'empty-link',
                title: 'Empty',
              },
            ],
            type: 'section',
            sourceId: 'section:links',
            title: 'Links only',
          },
        ],
        type: 'scope',
        routePrefix: '/',
        sourceId: 'scope:docs',
        title: 'Docs',
      },
    ],
    schemaVersion: 2,
    source: { configPaths: [], framework: 'vitepress', root: 'docs' },
  },
}

describe('selectSourceAnalysis', () => {
  it('keeps selected documents, their ancestors, and sibling navigation links', () => {
    const selected = selectSourceAnalysis(analysis, ['docs/b.md'])

    expect(selected.sourceRefs).toEqual(['docs/b.md'])
    expect(selected.analysis.documents.map((document) => document.sourceRef)).toEqual(['docs/b.md'])
    expect(JSON.stringify(selected.analysis.tree.navigation)).toContain('docs/b.md')
    expect(JSON.stringify(selected.analysis.tree.navigation)).not.toContain('docs/a.md')
    expect(JSON.stringify(selected.analysis.tree.navigation)).toContain('https://example.com')
    expect(JSON.stringify(selected.analysis.tree.navigation)).not.toContain('https://empty.example')
  })

  it('rejects empty and unknown selections', () => {
    expect(() => selectSourceAnalysis(analysis, [])).toThrow('Select at least one document')
    expect(() => selectSourceAnalysis(analysis, ['docs/missing.md'])).toThrow('unknown documents')
  })
})
