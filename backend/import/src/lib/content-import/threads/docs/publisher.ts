/**
 * Prepares title provenance once per Apply Workflow, then publishes and stages
 * one selected source document per durable step.
 *
 *   Analysis -> selected title sources
 *   R2 Markdown + title source -> BodyBag -> Phoenix staging -> Job status
 *
 * @see docs/import/markdown-title-normalization.md
 * @see docs/import/import-error-handling.md
 */
import { ArtimentPublisherError, publishArtiment } from '@groupher/content-publisher'

import { DocumentImporterError } from '../../../document-importer/error'
import { deserializeMarkdown, type TMarkdownSource } from '../../../document-importer/markdown'
import type { PreviewStore } from '../../core/preview-store'
import {
  MAX_BATCH_BYTES,
  MAX_BODY_BAG_BYTES,
  stageDocImportBodies,
  stageDocImportRequestBytes,
  type TDocImportFailed,
  type TDocImportStageItem,
} from '../../transport/phoenix/docsImport'
import { extractDocumentSource } from './analyzer/documentFile'
import { consumePromotedHeading, type TDocumentTitleSource } from './documentTitle'

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

type TPreviewAttempt = { attemptRef: string; previewRef: string }

/** Checkpoints only the codec and ordered title origins needed by subsequent steps. */
export const prepareDocStaging = async (
  store: Pick<PreviewStore, 'getAnalysis'>,
  { previewRef, attemptRef }: TPreviewAttempt,
  sourceRefs: readonly string[],
): Promise<{ markdownSource: TMarkdownSource; titleSources: (TDocumentTitleSource | null)[] }> => {
  const analysis = await store.getAnalysis(previewRef, attemptRef)
  if (!analysis) throw new Error('Preview analysis is missing.')
  const titles = new Map(analysis.documents.map((doc) => [doc.sourceRef, doc.titleSource]))
  return {
    markdownSource: markdownSourceForFramework(analysis.tree.source.framework),
    titleSources: sourceRefs.map((ref) => titles.get(ref) ?? null),
  }
}

/** Reads one source body by key and returns the Job status after staging its outcome. */
export const stagePreviewDoc = async (
  store: Pick<PreviewStore, 'getSource'>,
  {
    community,
    jobRef,
    previewRef,
    attemptRef,
  }: TPreviewAttempt & { community: string; jobRef: string },
  sourceRef: string,
  markdownSource: TMarkdownSource,
  titleSource: TDocumentTitleSource | null,
): Promise<string> => {
  const source = await store.getSource(previewRef, attemptRef, sourceRef)
  let item: TDocImportStageItem
  if (!source) {
    item = sourceFailure(sourceRef, `Preview source ${sourceRef} is missing.`)
  } else if (!titleSource) {
    item = sourceFailure(sourceRef, `Preview metadata ${sourceRef} is missing.`)
  } else {
    item = await publishSource(sourceRef, source.markdown, markdownSource, titleSource)
  }
  if (stageDocImportRequestBytes(community, jobRef, [item]) > MAX_BATCH_BYTES) {
    throw new Error(`Preview source ${sourceRef} exceeds the GraphQL request byte limit.`)
  }
  return stageDocImportBodies(community, jobRef, [item], {
    serviceSubject: 'service:content-import',
  })
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
