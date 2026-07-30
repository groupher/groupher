/**
 * Source-analysis contract persisted between analysis and apply workflows.
 *
 * @see docs/bulk-import/content-import-architecture.md
 * @see docs/bulk-import/markdown-title-normalization.md
 */
import type { TBadSmell } from '../../../core/contracts'
import {
  array,
  ContractError,
  integer,
  literal,
  oneOf,
  optionalString,
  record,
  string,
} from './decoder'
import { decodeBadSmells } from './diagnostic'
import { decodeSourceTree, type TSourceTree } from './sourceTree'

export const SOURCE_ANALYSIS_SCHEMA_VERSION = 2 as const
export const DOCUMENT_TITLE_SOURCES = ['heading', 'metadata', 'filename'] as const

export type TDocumentTitleSource = (typeof DOCUMENT_TITLE_SOURCES)[number]

export type TSourceDocument = {
  contentHash: string
  metadataTitle?: string
  route: string
  sizeBytes: number
  sourceRef: string
  title: string
  titleSource: TDocumentTitleSource
}

export type TSourceAnalysis = {
  badSmells: TBadSmell[]
  documents: TSourceDocument[]
  schemaVersion: typeof SOURCE_ANALYSIS_SCHEMA_VERSION
  tree: TSourceTree
}

/** Decodes bounded document metadata, diagnostics, title provenance, and SourceTree. */
export const decodeSourceAnalysis = (value: unknown): TSourceAnalysis => {
  const input = record(value, 'sourceAnalysis')
  const documents = array(input.documents, 'sourceAnalysis.documents')
  if (documents.length > 5_000) {
    throw new ContractError('sourceAnalysis.documents', 'exceeds 5000 documents')
  }

  return {
    badSmells: decodeBadSmells(input.badSmells, 'sourceAnalysis.badSmells'),
    documents: documents.map((value, index) => {
      const path = `sourceAnalysis.documents[${index}]`
      const document = record(value, path)
      return {
        contentHash: string(document.contentHash, `${path}.contentHash`, 128),
        metadataTitle: optionalString(document.metadataTitle, `${path}.metadataTitle`, 512),
        route: string(document.route, `${path}.route`, 1_024),
        sizeBytes: integer(document.sizeBytes, `${path}.sizeBytes`),
        sourceRef: string(document.sourceRef, `${path}.sourceRef`, 1_024),
        title: string(document.title, `${path}.title`, 512),
        titleSource: oneOf(document.titleSource, DOCUMENT_TITLE_SOURCES, `${path}.titleSource`),
      }
    }),
    schemaVersion: literal(
      input.schemaVersion,
      SOURCE_ANALYSIS_SCHEMA_VERSION,
      'sourceAnalysis.schemaVersion',
    ),
    tree: decodeSourceTree(input.tree),
  }
}
