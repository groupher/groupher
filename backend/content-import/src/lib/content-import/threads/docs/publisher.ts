/**
 * Converts persisted source Markdown into bounded BodyBag batches and applies them.
 *
 *   PreviewStore Markdown + SourceAnalysis
 *                  |
 *                  v
 *   framework deserialize -> title/H1 normalization -> publish BodyBag
 *                  |
 *                  v
 *   bounded GraphQL batches -> PostgreSQL staging -> one atomic apply
 *
 * Per-document conversion failures are staged as item results so one bad file
 * does not abort otherwise valid documents. Batch/request failures remain
 * workflow failures.
 *
 * @see docs/bulk-import/article-publish-import-refactor.md
 * @see docs/bulk-import/markdown-title-normalization.md
 * @see docs/bulk-import/import-error-handling.md
 */
import { ArtimentPublisherError, publishArtiment } from '@groupher/artiment-publisher'

import { DocumentImporterError } from '../../../document-importer/error'
import { deserializeMarkdown, type TMarkdownSource } from '../../../document-importer/markdown'
import type { PreviewStore } from '../../core/preview-store'
import {
  applyDocImport,
  MAX_BATCH_BYTES,
  MAX_BATCH_COUNT,
  MAX_BODY_BAG_BYTES,
  stageDocImportBodies,
  stageDocImportRequestBytes,
  type TDocImportApplyResult,
  type TDocImportBodyStageResult,
  type TDocImportFailed,
  type TDocImportStageItem,
} from '../../transport/phoenix/docsImport'
import { extractDocumentSource } from './analyzer/documentFile'
import { consumePromotedHeading, type TDocumentTitleSource } from './documentTitle'

type TOptions = {
  backendToken?: string
  fetchImpl?: typeof fetch
  graphqlEndpoint?: string
  onProgress?: (completed: number, total: number) => void
  serviceIdentity: string
}

const MARKDOWN_SOURCE_BY_FRAMEWORK = {
  docusaurus: 'docusaurus',
  fumadocs: 'fumadocs',
  mkdocs: 'mkdocs-material',
  nextra: 'nextra',
  rspress: 'rspress',
  starlight: 'starlight',
  vitepress: 'vitepress',
} satisfies Record<string, TMarkdownSource>

const markdownSourceForFramework = (framework: string): TMarkdownSource =>
  MARKDOWN_SOURCE_BY_FRAMEWORK[framework as keyof typeof MARKDOWN_SOURCE_BY_FRAMEWORK] ?? 'groupher'

/** Converts, stages, and atomically applies the selected source documents for one Job. */
export const runPreviewDocBulkImport = async (
  community: string,
  jobRef: string,
  previewRef: string,
  attemptRef: string,
  selectedSourceRefs: string[],
  store: PreviewStore,
  options: TOptions,
): Promise<TDocImportApplyResult | TDocImportBodyStageResult> => {
  const [storedSourceRefs, dataset, analysis] = await Promise.all([
    store.listSourceRefs(previewRef, attemptRef),
    store.getDataset(previewRef, attemptRef),
    store.getAnalysis(previewRef, attemptRef),
  ])
  if (!dataset) throw new Error('Preview dataset is missing.')
  if (!analysis) throw new Error('Preview analysis is missing.')

  const availableSourceRefs = new Set(storedSourceRefs)
  const documentsBySourceRef = new Map(
    analysis.documents.map((document) => [document.sourceRef, document]),
  )
  const markdownSource = markdownSourceForFramework(dataset.sourceInfo.framework)
  const sourceRefs = Array.from(new Set(selectedSourceRefs))
  if (sourceRefs.length === 0) throw new Error('The import contains no documents.')

  let batch: TDocImportStageItem[] = []
  let completed = 0
  const state: { latestStage?: TDocImportBodyStageResult } = {}

  const flush = async (): Promise<void> => {
    if (batch.length === 0) return
    state.latestStage = await stageDocImportBodies(community, jobRef, batch, options)
    completed += batch.length
    options.onProgress?.(completed, sourceRefs.length)
    batch = []
  }

  for (const sourceRef of sourceRefs) {
    const source = availableSourceRefs.has(sourceRef)
      ? await store.getSource(previewRef, attemptRef, sourceRef)
      : null
    const document = documentsBySourceRef.get(sourceRef)
    const item = source
      ? document
        ? await publishSource(sourceRef, source.markdown, markdownSource, document.titleSource)
        : sourceFailure(sourceRef, `Preview metadata ${sourceRef} is missing.`)
      : sourceFailure(sourceRef, `Preview source ${sourceRef} is missing.`)
    const candidate = [...batch, item]
    if (
      batch.length > 0 &&
      (candidate.length > MAX_BATCH_COUNT ||
        stageDocImportRequestBytes(community, jobRef, candidate) > MAX_BATCH_BYTES)
    ) {
      await flush()
    }
    batch.push(item)
    if (stageDocImportRequestBytes(community, jobRef, batch) > MAX_BATCH_BYTES) {
      throw new Error(`Preview source ${sourceRef} exceeds the GraphQL request byte limit.`)
    }
  }
  await flush()

  if (state.latestStage?.status.toLowerCase() === 'failed') return state.latestStage
  return applyDocImport(community, jobRef, options)
}

const sourceFailure = (externalRef: string, message: string): TDocImportFailed => ({
  externalRef,
  failed: { code: 'source_missing', message, stage: 'source' },
})

const publishSource = async (
  externalRef: string,
  markdown: string,
  source: TMarkdownSource,
  titleSource: TDocumentTitleSource,
): Promise<TDocImportStageItem> => {
  try {
    const value = deserializeMarkdown(extractDocumentSource(markdown).body, { source })
    const bodyBag = await publishArtiment(consumePromotedHeading(value, titleSource))
    if (Buffer.byteLength(JSON.stringify(bodyBag), 'utf8') > MAX_BODY_BAG_BYTES) {
      return { externalRef, skipped: { code: 'content_too_large' } }
    }
    return { bodyBag, externalRef }
  } catch (error) {
    if (
      (error instanceof ArtimentPublisherError || error instanceof DocumentImporterError) &&
      error.code === 'payload_too_large'
    ) {
      return { externalRef, skipped: { code: 'content_too_large' } }
    }
    if (error instanceof ArtimentPublisherError || error instanceof DocumentImporterError) {
      return {
        externalRef,
        failed: { code: error.code, message: error.message, stage: 'conversion' },
      }
    }
    return {
      externalRef,
      failed: {
        code: 'conversion_failed',
        message: error instanceof Error ? error.message : 'Document conversion failed.',
        stage: 'conversion',
      },
    }
  }
}

export type {
  TDocImportApplyResult,
  TDocImportBodyStageResult,
} from '../../transport/phoenix/docsImport'
