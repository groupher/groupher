import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DocumentImporterError } from '../../../document-importer/error'
import type { PreviewStore } from '../../core/preview-store'

const mocks = vi.hoisted(() => ({
  applyDocImport: vi.fn(),
  deserializeMarkdown: vi.fn(),
  publishArtiment: vi.fn(),
  stageDocImportBodies: vi.fn(),
  stageDocImportRequestBytes: vi.fn(),
}))

vi.mock('../../../artiment-publisher', () => ({ publishArtiment: mocks.publishArtiment }))
vi.mock('../../../document-importer/markdown', () => ({
  deserializeMarkdown: mocks.deserializeMarkdown,
}))
vi.mock('../../transport/phoenix/docsImport', () => ({
  applyDocImport: mocks.applyDocImport,
  MAX_BATCH_BYTES: 6 * 1024 * 1024,
  MAX_BATCH_COUNT: 4,
  MAX_BODY_BAG_BYTES: 5 * 1024 * 1024,
  stageDocImportBodies: mocks.stageDocImportBodies,
  stageDocImportRequestBytes: mocks.stageDocImportRequestBytes,
}))

import { runPreviewDocBulkImport } from './publisher'

const sourceRefs = [
  'docs/a.md',
  'docs/b.md',
  'docs/large.md',
  'docs/broken.md',
  'docs/missing.md',
  ...Array.from({ length: 5 }, (_, index) => `docs/${index}.md`),
]

const withDataset = (
  store: object,
  framework = 'vitepress',
  titleSources: Record<string, 'filename' | 'heading' | 'metadata'> = {},
): PreviewStore =>
  ({
    getAnalysis: vi.fn(async () => ({
      badSmells: [],
      documents: sourceRefs.map((sourceRef) => ({
        contentHash: `hash:${sourceRef}`,
        route: `/${sourceRef}`,
        sizeBytes: 1,
        sourceRef,
        title: sourceRef,
        titleSource: titleSources[sourceRef] ?? 'heading',
      })),
      schemaVersion: 2,
      tree: {
        navigation: [],
        schemaVersion: 1,
        source: { configPaths: [], framework, root: 'docs' },
      },
    })),
    getDataset: vi.fn(async () => ({ sourceInfo: { framework } })),
    ...store,
  }) as unknown as PreviewStore

describe('runPreviewDocBulkImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deserializeMarkdown.mockReturnValue([{ text: 'Body', type: 'p' }])
    mocks.publishArtiment.mockResolvedValue({ document: [] })
    mocks.stageDocImportRequestBytes.mockReturnValue(100)
    mocks.stageDocImportBodies.mockResolvedValue({
      failedItems: [],
      jobRef: 'job-1',
      progress: {},
      skipped: [],
      status: 'ready',
    })
    mocks.applyDocImport.mockResolvedValue({ firstImportedDocRef: 'doc-1', status: 'completed' })
  })

  it('publishes and stages only the selected source refs', async () => {
    const store = withDataset({
      getSource: vi.fn(async (_previewRef: string, _attemptRef: string, sourceRef: string) => ({
        markdown: `# ${sourceRef}`,
        sourceRef,
      })),
      listSourceRefs: vi.fn(async () => ['docs/a.md', 'docs/b.md']),
    })

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/b.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(store.getSource).toHaveBeenCalledTimes(1)
    expect(store.getSource).toHaveBeenCalledWith('prv_123456', 'att_123456', 'docs/b.md')
    expect(store.getAnalysis).toHaveBeenCalledWith('prv_123456', 'att_123456')
    expect(store.getDataset).toHaveBeenCalledWith('prv_123456', 'att_123456')
    expect(mocks.deserializeMarkdown).toHaveBeenCalledWith('# docs/b.md', {
      source: 'vitepress',
    })
    expect(mocks.stageDocImportBodies).toHaveBeenCalledWith(
      'home',
      'job-1',
      [{ bodyBag: { document: [] }, externalRef: 'docs/b.md' }],
      expect.objectContaining({ serverTrustSecret: 'secret' }),
    )
  })

  it('consumes a promoted leading H1 from the target body AST', async () => {
    const heading = { children: [{ text: 'Title' }], type: 'h1' }
    const paragraph = { children: [{ text: 'Body' }], type: 'p' }
    mocks.deserializeMarkdown.mockReturnValueOnce([heading, paragraph])
    const store = withDataset({
      getSource: vi.fn(async () => ({ markdown: '# Title\n\nBody', sourceRef: 'docs/a.md' })),
      listSourceRefs: vi.fn(async () => ['docs/a.md']),
    })

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/a.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.publishArtiment).toHaveBeenCalledWith([paragraph])
  })

  it('does not send YAML frontmatter to the body deserializer', async () => {
    const store = withDataset({
      getSource: vi.fn(async () => ({
        markdown: '---\ntitle: Search title\n---\n# Visible title\n\nBody',
        sourceRef: 'docs/a.md',
      })),
      listSourceRefs: vi.fn(async () => ['docs/a.md']),
    })

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/a.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.deserializeMarkdown).toHaveBeenCalledWith('# Visible title\n\nBody', {
      source: 'vitepress',
    })
  })

  it('preserves a leading H1 when the document title came from metadata', async () => {
    const heading = { children: [{ text: 'Section heading' }], type: 'h1' }
    const paragraph = { children: [{ text: 'Body' }], type: 'p' }
    mocks.deserializeMarkdown.mockReturnValueOnce([heading, paragraph])
    const store = withDataset(
      {
        getSource: vi.fn(async () => ({ markdown: '# Section heading', sourceRef: 'docs/a.md' })),
        listSourceRefs: vi.fn(async () => ['docs/a.md']),
      },
      'vitepress',
      { 'docs/a.md': 'metadata' },
    )

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/a.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.publishArtiment).toHaveBeenCalledWith([heading, paragraph])
  })

  it('stages only the fixed content_too_large skip for a Plate input capacity error', async () => {
    mocks.deserializeMarkdown.mockImplementationOnce(() => {
      throw new DocumentImporterError('payload_too_large', 'too large')
    })
    const store = withDataset({
      getSource: vi.fn(async () => ({ markdown: '# Large', sourceRef: 'docs/large.md' })),
      listSourceRefs: vi.fn(async () => ['docs/large.md']),
    })

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/large.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.stageDocImportBodies).toHaveBeenCalledWith(
      'home',
      'job-1',
      [{ externalRef: 'docs/large.md', skipped: { code: 'content_too_large' } }],
      expect.anything(),
    )
  })

  it('records an ordinary conversion failure and continues the import', async () => {
    mocks.deserializeMarkdown.mockImplementationOnce(() => {
      throw new DocumentImporterError('unsupported_markdown', 'unsupported')
    })
    const store = withDataset({
      getSource: vi.fn(async () => ({ markdown: '# Broken', sourceRef: 'docs/broken.md' })),
      listSourceRefs: vi.fn(async () => ['docs/broken.md']),
    })

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/broken.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.stageDocImportBodies).toHaveBeenCalledWith(
      'home',
      'job-1',
      [
        {
          externalRef: 'docs/broken.md',
          failed: {
            code: 'unsupported_markdown',
            message: 'unsupported',
            stage: 'conversion',
          },
        },
      ],
      expect.anything(),
    )
    expect(mocks.applyDocImport).toHaveBeenCalledOnce()
  })

  it('keeps missing preview sources as per-document failures', async () => {
    const store = withDataset({
      getSource: vi.fn(async () => ({ markdown: '# Available', sourceRef: 'docs/a.md' })),
      listSourceRefs: vi.fn(async () => ['docs/a.md']),
    })

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/a.md', 'docs/missing.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.stageDocImportBodies).toHaveBeenCalledWith(
      'home',
      'job-1',
      [
        { bodyBag: { document: [] }, externalRef: 'docs/a.md' },
        {
          externalRef: 'docs/missing.md',
          failed: {
            code: 'source_missing',
            message: 'Preview source docs/missing.md is missing.',
            stage: 'source',
          },
        },
      ],
      expect.anything(),
    )
  })

  it('does not apply an all-failed Job after staging records the item errors', async () => {
    mocks.deserializeMarkdown.mockImplementationOnce(() => {
      throw new DocumentImporterError('unsupported_markdown', 'unsupported')
    })
    mocks.stageDocImportBodies.mockResolvedValueOnce({
      failedItems: [
        {
          code: 'unsupported_markdown',
          externalRef: 'docs/broken.md',
          message: 'unsupported',
          stage: 'conversion',
        },
      ],
      jobRef: 'job-1',
      progress: {},
      skipped: [],
      status: 'failed',
    })
    const store = withDataset({
      getSource: vi.fn(async () => ({ markdown: '# Broken', sourceRef: 'docs/broken.md' })),
      listSourceRefs: vi.fn(async () => ['docs/broken.md']),
    })

    const result = await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/broken.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(result.status).toBe('failed')
    expect(mocks.applyDocImport).not.toHaveBeenCalled()
  })

  it('stages at most four documents in one batch', async () => {
    const sourceRefs = Array.from({ length: 5 }, (_, index) => `docs/${index}.md`)
    const store = withDataset({
      getSource: vi.fn(async (_previewRef: string, _attemptRef: string, sourceRef: string) => ({
        markdown: `# ${sourceRef}`,
        sourceRef,
      })),
      listSourceRefs: vi.fn(async () => sourceRefs),
    })

    await runPreviewDocBulkImport('home', 'job-1', 'prv_123456', 'att_123456', sourceRefs, store, {
      serverTrustSecret: 'secret',
    })

    expect(mocks.stageDocImportBodies).toHaveBeenCalledTimes(2)
    expect(mocks.stageDocImportBodies.mock.calls[0]![2]).toHaveLength(4)
    expect(mocks.stageDocImportBodies.mock.calls[1]![2]).toHaveLength(1)
  })

  it('maps MkDocs repositories to the compatible Markdown source', async () => {
    const store = withDataset(
      {
        getSource: vi.fn(async () => ({ markdown: '!!! note\n    Body', sourceRef: 'docs/a.md' })),
        listSourceRefs: vi.fn(async () => ['docs/a.md']),
      },
      'mkdocs',
    )

    await runPreviewDocBulkImport(
      'home',
      'job-1',
      'prv_123456',
      'att_123456',
      ['docs/a.md'],
      store,
      { serverTrustSecret: 'secret' },
    )

    expect(mocks.deserializeMarkdown).toHaveBeenCalledWith('!!! note\n    Body', {
      source: 'mkdocs-material',
    })
  })
})
