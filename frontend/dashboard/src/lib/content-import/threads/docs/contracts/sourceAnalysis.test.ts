import { describe, expect, it } from 'vitest'

import { decodeSourceAnalysis, SOURCE_ANALYSIS_SCHEMA_VERSION } from './sourceAnalysis'

const analysis = {
  badSmells: [],
  documents: [
    {
      contentHash: 'source-md-v1:abc',
      metadataTitle: 'Search title',
      route: '/guide',
      sizeBytes: 42,
      sourceRef: 'docs/guide.md',
      title: 'Visible title',
      titleSource: 'heading',
    },
  ],
  schemaVersion: SOURCE_ANALYSIS_SCHEMA_VERSION,
  tree: {
    navigation: [],
    schemaVersion: 1,
    source: { configPaths: [], framework: 'vitepress', root: 'docs' },
  },
}

describe('decodeSourceAnalysis', () => {
  it('preserves normalized title provenance', () => {
    expect(decodeSourceAnalysis(analysis).documents[0]).toMatchObject({
      metadataTitle: 'Search title',
      title: 'Visible title',
      titleSource: 'heading',
    })
  })

  it('rejects source analysis without title provenance', () => {
    const withoutTitleSource = structuredClone(analysis)
    delete (withoutTitleSource.documents[0] as Partial<{ titleSource: string }>).titleSource

    expect(() => decodeSourceAnalysis(withoutTitleSource)).toThrow(
      'sourceAnalysis.documents[0].titleSource',
    )
  })

  it('rejects the previous analysis schema version', () => {
    expect(() => decodeSourceAnalysis({ ...analysis, schemaVersion: 1 })).toThrow(
      'sourceAnalysis.schemaVersion',
    )
  })
})
