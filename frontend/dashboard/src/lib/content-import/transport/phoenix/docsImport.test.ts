import { describe, expect, it, vi } from 'vitest'

vi.mock('~/config', () => ({ GRAPHQL_ENDPOINT: 'https://example.test/graphql' }))
vi.mock('~/const/serverTrust', () => ({ GROUPHER_SERVER_TRUST_HEADER: 'x-server-trust' }))

import {
  SOURCE_ANALYSIS_SCHEMA_VERSION,
  type TDocImportPreview,
  type TSourceAnalysis,
} from '../../threads/docs/contracts'
import {
  cancelDocImport,
  previewDocImportTarget,
  startDocImport,
  type TSourceInfo,
} from './docsImport'

const tree = {
  navigation: [],
  schemaVersion: 1 as const,
  source: { configPaths: [], framework: 'vitepress', root: 'docs' },
}

const analysis: TSourceAnalysis = {
  badSmells: [],
  documents: [],
  schemaVersion: SOURCE_ANALYSIS_SCHEMA_VERSION,
  tree,
}

const sourceInfo: TSourceInfo = {
  branch: 'main',
  commit: 'abc123',
  configPaths: [],
  contentRoot: 'docs',
  framework: 'vitepress',
  repo: 'acme/docs',
  repoUrl: 'https://github.com/acme/docs',
}

describe('Docs import GraphQL Json variables', () => {
  it('encodes SourceTree objects as the backend Json scalar string input', async () => {
    const requests: Array<Record<string, unknown>> = []
    const fetchImpl: typeof fetch = async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      const query = String((requests.at(-1) as { query?: unknown }).query)
      const data = query.includes('PreviewDocContentImportTarget')
        ? {
            previewDocContentImportTarget: {
              conflicts: [],
              counts: { assets: 0, groups: 0, links: 0, pages: 0, tabs: 0 },
              targetRevision: 'revision-1',
              targetTree: { tabs: [] },
            },
          }
        : query.includes('CancelDocContentImport')
          ? { cancelDocContentImport: { id: 'job-1', status: 'cancelled' } }
          : { startDocContentImport: { id: 'job-1', status: 'ready' } }
      return Response.json({ data })
    }

    const target = await previewDocImportTarget('home', sourceInfo, analysis, {
      fetchImpl,
      serverTrustSecret: 'server-trust',
    })
    await startDocImport(
      'home',
      {
        badSmells: [],
        conflicts: target.conflicts,
        counts: target.counts,
        expiresAt: new Date().toISOString(),
        previewRef: 'prv_123456',
        schemaVersion: 1,
        sourceInfo,
        targetRevision: target.targetRevision,
        targetTree: target.targetTree,
        tree,
      } satisfies TDocImportPreview,
      analysis,
      'dset_123',
      { backendToken: 'backend-token', fetchImpl, serverTrustSecret: 'server-trust' },
    )
    await cancelDocImport('home', 'job-1', { fetchImpl, serverTrustSecret: 'server-trust' })

    expect(requests).toHaveLength(3)
    const previewVariables = requests[0]!.variables as Record<string, unknown>
    expect(typeof previewVariables.tree).toBe('string')
    expect(JSON.parse(previewVariables.tree as string)).toEqual(tree)

    const startVariables = requests[1]!.variables as Record<string, unknown>
    expect(startVariables.datasetRef).toBe('dset_123')
    expect(typeof startVariables.targetTree).toBe('string')

    expect(requests[2]!.variables).toEqual({ community: 'home', jobRef: 'job-1' })
  })
})
