/**
 * The only Markdown/MDX -> Plate boundary shared by single and bulk imports.
 *
 * Markdown/MDX -> rich-editor MarkdownKit -> validated Plate value
 *
 * Title promotion and consumed-H1 semantics are implemented by the shared codec;
 * callers provide source options instead of deleting arbitrary first headings.
 *
 * @see docs/bulk-import/markdown-title-normalization.md
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import {
  deserializeMarkdown as deserializeRichEditorMarkdown,
  type TRichEditorMarkdownImportDiagnostic,
  type TRichEditorMarkdownImportOptions,
  type TRichEditorNodeValue,
  type TRichEditorValidationDiagnostic,
} from '@groupher/rich-editor/node'

import { ArtimentPublisherError } from '../artiment-publisher/error'
import { assertValidArtimentValue } from '../artiment-publisher/validate'
import { DocumentImporterError } from './error'

type TMarkdownImportResult = {
  diagnostics: TRichEditorMarkdownImportDiagnostic[]
  value: TRichEditorNodeValue
}

export type TMarkdownSource = NonNullable<TRichEditorMarkdownImportOptions['source']>

const readValidationDiagnostics = (error: unknown): TRichEditorValidationDiagnostic[] => {
  if (!error || typeof error !== 'object' || !('diagnostics' in error)) return []

  const { diagnostics } = error as { diagnostics?: unknown }
  return Array.isArray(diagnostics) ? (diagnostics as TRichEditorValidationDiagnostic[]) : []
}

const unsupportedMarkdownError = (
  diagnostics: TRichEditorValidationDiagnostic[],
): DocumentImporterError =>
  new DocumentImporterError(
    'unsupported_markdown',
    'The converted document contains blocks that this editor does not support yet.',
    {
      diagnostics: diagnostics.map((diagnostic) => ({
        ...diagnostic,
        level: 'error' as const,
      })),
      status: 422,
    },
  )

/** Deserializes Markdown and preserves warnings alongside the validated Plate value. */
export const deserializeMarkdownResult = (
  markdown: unknown,
  options: TRichEditorMarkdownImportOptions = {},
): TMarkdownImportResult => {
  if (typeof markdown !== 'string') {
    throw new DocumentImporterError(
      'invalid_converter_response',
      'Document converter response must contain Markdown.',
      { status: 502 },
    )
  }

  if (!markdown.trim()) {
    throw new DocumentImporterError('empty_document', 'The converted document is empty.', {
      status: 422,
    })
  }

  try {
    const result = deserializeRichEditorMarkdown(markdown, options)
    assertValidArtimentValue(result.value)

    return {
      diagnostics: result.diagnostics,
      value: result.value as TRichEditorNodeValue,
    }
  } catch (error) {
    if (!(error instanceof ArtimentPublisherError)) {
      const diagnostics = readValidationDiagnostics(error)
      if (diagnostics.length > 0) throw unsupportedMarkdownError(diagnostics)
      throw error
    }

    const unsupportedMarkdown = error.code === 'invalid_value'
    if (unsupportedMarkdown && error.diagnostics) {
      throw unsupportedMarkdownError(error.diagnostics)
    }

    throw new DocumentImporterError(
      unsupportedMarkdown ? 'unsupported_markdown' : error.code,
      unsupportedMarkdown
        ? 'The converted document contains blocks that this editor does not support yet.'
        : error.message,
      {
        diagnostics: error.diagnostics?.map((diagnostic) => ({
          ...diagnostic,
          level: 'error' as const,
        })),
        status: error.status,
      },
    )
  }
}

/** Deserializes Markdown when the caller needs only the validated Plate value. */
export const deserializeMarkdown = (
  markdown: unknown,
  options: TRichEditorMarkdownImportOptions = {},
): TRichEditorNodeValue => deserializeMarkdownResult(markdown, options).value
