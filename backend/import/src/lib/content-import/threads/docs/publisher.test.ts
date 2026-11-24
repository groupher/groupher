import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocumentImporterError } from '../../../document-importer/error'
import { MAX_BATCH_BYTES, MAX_BODY_BAG_BYTES } from '../../transport/phoenix/docsImport'
import type { TSourceAnalysis, TSourceDocument } from './contracts'
import { prepareDocStaging, stagePreviewDoc } from './publisher'

const mocks = vi.hoisted(() => ({
  deserializeMarkdown: vi.fn(),
  publishArtiment: vi.fn(),
  stageDocImportBodies: vi.fn(),
  stageDocImportRequestBytes: vi.fn(),
}))

vi.mock('@groupher/content-publisher', () => ({
  ArtimentPublisherError: class ArtimentPublisherError extends Error {},
  publishArtiment: mocks.publishArtiment,
}))
vi.mock('../../../document-importer/markdown', () => ({
  deserializeMarkdown: mocks.deserializeMarkdown,
}))
vi.mock('../../transport/phoenix/docsImport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../transport/phoenix/docsImport')>()),
  stageDocImportBodies: mocks.stageDocImportBodies,
  stageDocImportRequestBytes: mocks.stageDocImportRequestBytes,
}))

const job = {
  community: 'home',
  jobRef: 'job-1',
  previewRef: 'prv_123456',
  attemptRef: 'att_123456',
}
const sourceRef = 'docs/a.md'
const source = (markdown: string) => ({ getSource: vi.fn(async () => ({ markdown, sourceRef })) })
const analysis = (documents: TSourceDocument[]): TSourceAnalysis => ({
  badSmells: [],
  documents,
  schemaVersion: 2,
  tree: {
    navigation: [],
    schemaVersion: 2,
    source: { configPaths: [], framework: 'mkdocs', root: 'docs' },
  },
})
const document = (ref: string, titleSource: TSourceDocument['titleSource']): TSourceDocument => ({
  contentHash: 'hash',
  route: '/intro',
  sizeBytes: 1,
  sourceRef: ref,
  title: 'Intro',
  titleSource,
})

describe('selected Docs staging', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.deserializeMarkdown.mockReturnValue([{ children: [{ text: 'Body' }], type: 'p' }])
    mocks.publishArtiment.mockResolvedValue({ document: [] })
    mocks.stageDocImportRequestBytes.mockReturnValue(100)
    mocks.stageDocImportBodies.mockResolvedValue('READY')
  })

  it('reads the analysis once and only downloads the selected source bodies, in selection order', async () => {
    const selected = ['docs/b.md', 'docs/a.md', 'docs/orphan.md']
    const store = {
      getAnalysis: vi.fn(async () =>
        analysis([
          document('docs/a.md', 'heading'),
          document('docs/b.md', 'metadata'),
          document('docs/c.md', 'filename'),
        ]),
      ),
      getSource: vi.fn(async (_preview: string, _attempt: string, ref: string) => ({
        markdown: ref,
        sourceRef: ref,
      })),
    }
    const { markdownSource, titleSources } = await prepareDocStaging(store, job, selected)
    expect(markdownSource).toBe('mkdocs-material')
    expect(titleSources).toEqual(['metadata', 'heading', null])
    for (const [index, ref] of selected.entries()) {
      await stagePreviewDoc(store, job, ref, markdownSource, titleSources[index] ?? null)
    }

    expect(store.getAnalysis).toHaveBeenCalledOnce()
    expect(store.getSource.mock.calls).toEqual(
      selected.map((ref) => [job.previewRef, job.attemptRef, ref]),
    )
    expect(mocks.deserializeMarkdown).toHaveBeenCalledWith('docs/b.md', {
      source: 'mkdocs-material',
    })
    expect(mocks.stageDocImportBodies).toHaveBeenCalledTimes(3)
    expect(mocks.stageDocImportBodies).toHaveBeenNthCalledWith(
      1,
      job.community,
      job.jobRef,
      [{ bodyBag: { document: [] }, externalRef: 'docs/b.md' }],
      { serviceSubject: 'service:content-import' },
    )
    expect(mocks.stageDocImportBodies.mock.calls[2]![2]).toEqual([
      {
        externalRef: 'docs/orphan.md',
        failed: {
          code: 'source_missing',
          message: 'Preview metadata docs/orphan.md is missing.',
          stage: 'source',
        },
      },
    ])
  })

  it('fails preparation before staging when the analysis is unavailable', async () => {
    await expect(
      prepareDocStaging({ getAnalysis: async () => null }, job, [sourceRef]),
    ).rejects.toThrow('Preview analysis is missing')
    expect(mocks.stageDocImportBodies).not.toHaveBeenCalled()
  })

  it.each(['heading', 'metadata', 'filename'] as const)(
    'normalizes frontmatter and the leading heading for a %s title',
    async (titleSource) => {
      const heading = { children: [{ text: 'Title' }], type: 'h1' }
      const paragraph = { children: [{ text: 'Body' }], type: 'p' }
      mocks.deserializeMarkdown.mockReturnValueOnce([heading, paragraph])
      await stagePreviewDoc(
        source('---\ntitle: Frontmatter title\n---\n# Title\n\nBody'),
        job,
        sourceRef,
        'vitepress',
        titleSource,
      )
      expect(mocks.deserializeMarkdown).toHaveBeenCalledWith('# Title\n\nBody', {
        source: 'vitepress',
      })
      expect(mocks.publishArtiment).toHaveBeenCalledWith(
        titleSource === 'heading' ? [paragraph] : [heading, paragraph],
      )
    },
  )

  it('preserves a missing body as a source failure and returns the terminal Job status', async () => {
    mocks.stageDocImportBodies.mockResolvedValueOnce('FAILED')
    await expect(
      stagePreviewDoc({ getSource: async () => null }, job, sourceRef, 'groupher', 'heading'),
    ).resolves.toBe('FAILED')
    expect(mocks.stageDocImportBodies.mock.calls[0]![2]).toEqual([
      {
        externalRef: sourceRef,
        failed: {
          code: 'source_missing',
          message: 'Preview source docs/a.md is missing.',
          stage: 'source',
        },
      },
    ])
  })

  it('stages unsupported content as a per-document conversion failure', async () => {
    mocks.deserializeMarkdown.mockImplementationOnce(() => {
      throw new DocumentImporterError('unsupported_markdown', 'unsupported')
    })
    await stagePreviewDoc(source('Broken'), job, sourceRef, 'groupher', 'heading')
    expect(mocks.stageDocImportBodies.mock.calls[0]![2]).toEqual([
      {
        externalRef: sourceRef,
        failed: { code: 'unsupported_markdown', message: 'unsupported', stage: 'conversion' },
      },
    ])
  })

  it.each(['input', 'body'])('skips an oversized %s with the fixed size code', async (kind) => {
    if (kind === 'input') {
      mocks.deserializeMarkdown.mockImplementationOnce(() => {
        throw new DocumentImporterError('payload_too_large', 'too large')
      })
    } else {
      mocks.publishArtiment.mockResolvedValueOnce({ data: 'x'.repeat(MAX_BODY_BAG_BYTES) })
    }
    await stagePreviewDoc(source('Large'), job, sourceRef, 'groupher', 'heading')
    expect(mocks.stageDocImportBodies.mock.calls[0]![2]).toEqual([
      { externalRef: sourceRef, skipped: { code: 'content_too_large' } },
    ])
  })

  it('enforces the wire request byte limit before staging', async () => {
    mocks.stageDocImportRequestBytes.mockReturnValueOnce(MAX_BATCH_BYTES + 1)
    await expect(
      stagePreviewDoc(source('Body'), job, sourceRef, 'groupher', 'heading'),
    ).rejects.toThrow('GraphQL request byte limit')
    expect(mocks.stageDocImportBodies).not.toHaveBeenCalled()
  })
})
