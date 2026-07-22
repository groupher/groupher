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
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import {
  RICH_EDITOR_SCHEMA_VERSION,
  canonicalizeValue,
  extractPlainText,
  extractToc,
  serializeHtmlUnsafe,
  serializeMarkdown,
} from '@groupher/rich-editor/node'

import { createBodyHash } from './hash'
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

export type { TArtimentBodyBag } from './types'
