import type { TContentSource } from '@groupher/contracts/content-publish'
/**
 * Shared Node publisher for every Article and Content Import consumer.
 *
 * Plate value
 *     |
 *     v
 * validate structure and size
 *     |
 *     +--> canonical value -> bodyHash
 *     +--> Markdown / TOC / plain text / digest
 *     `--> HTML serializer -> sanitizer
 *                    |
 *                    v
 *              canonical BodyBag
 *
 * @see docs/import/article-publish-import-refactor.md
 */
import {
  RICH_EDITOR_SCHEMA_VERSION,
  canonicalizeValue,
  extractPlainText,
  extractToc,
  serializeHtmlUnsafe,
  serializeMarkdown,
} from '@groupher/rich-editor/node'

import { ArtimentPublisherError } from './error'
import { createBodyHash } from './hash'
import { normalizeContentSource } from './normalize'
import { sanitizeArtimentHtml } from './sanitize'
import { createDigest, serializePlateJson } from './serialize'
import type { TArtimentBodyBag } from './types'
import { assertValidArtimentValue } from './validate'

/** Validates one Plate value and derives the complete canonical persistence BodyBag. */
export const publishArtiment = async (value: unknown): Promise<TArtimentBodyBag> => {
  assertValidArtimentValue(value)

  const htmlPromise = serializeHtmlUnsafe(value)
  // Persist editor identity in json, but hash semantic content without transient id/_id fields.
  const canonicalJson = JSON.stringify(canonicalizeValue(value))
  const plainText = extractPlainText(value)
  const toc = extractToc(value)
  const markdown = serializeMarkdown(value)
  const unsafeHtml = await htmlPromise

  return {
    json: serializePlateJson(value),
    markdown,
    html: sanitizeArtimentHtml(unsafeHtml),
    toc,
    plainText,
    digest: createDigest(plainText),
    bodyHash: createBodyHash(canonicalJson),
    schemaVersion: RICH_EDITOR_SCHEMA_VERSION,
  }
}

/** Normalizes a typed source and derives its canonical BodyBag. */
export const publishContent = async (source: TContentSource): Promise<TArtimentBodyBag> => {
  try {
    const { value } = normalizeContentSource(source)
    return publishArtiment(value)
  } catch (error) {
    if (error instanceof ArtimentPublisherError) throw error
    const diagnostics =
      error && typeof error === 'object' && 'diagnostics' in error
        ? (error.diagnostics as ArtimentPublisherError['diagnostics'])
        : undefined
    throw new ArtimentPublisherError('invalid_value', 'Content source could not be normalized.', {
      diagnostics,
    })
  }
}

export { ArtimentPublisherError } from './error'
export type {
  TArtimentBodyBag,
  TArtimentPublisherErrorCode,
  TArtimentPublisherErrorPayload,
} from './types'
export {
  ARTIMENT_MAX_INPUT_BYTES,
  ARTIMENT_MAX_NODE_COUNT,
  ARTIMENT_MAX_VALUE_DEPTH,
  assertValidArtimentValue,
} from './validate'
export { normalizeContentSource } from './normalize'
export * from './constants'
export type { TContentSource } from '@groupher/contracts/content-publish'
