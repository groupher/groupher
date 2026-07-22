import type { TBadSmell } from '../../../core/contracts'
/**
 * Public Review contract produced only after Phoenix target validation.
 *
 * @see docs/bulk-import/bulk-import.md
 */
import { array, integer, literal, record, string } from './decoder'
import { decodeBadSmells } from './diagnostic'
import type { TDocImportSourceInfo } from './sourceInfo'
import { decodeSourceTree, type TSourceTree } from './sourceTree'

export const DOC_IMPORT_PREVIEW_SCHEMA_VERSION = 1 as const
const PREVIEW_TREE_LIMITS = { maxDepth: 32, maxNodes: 6_000 } as const

export type TDocImportPreview = {
  conflicts: Array<Record<string, unknown>>
  counts: {
    assets: number
    groups: number
    links: number
    pages: number
    tabs: number
  }
  badSmells: TBadSmell[]
  expiresAt: string
  previewRef: string
  schemaVersion: typeof DOC_IMPORT_PREVIEW_SCHEMA_VERSION
  sourceInfo: TDocImportSourceInfo
  targetRevision: string
  targetTree: Record<string, unknown>
  tree: TSourceTree
}

/** Decodes the ready Review payload read from PreviewStore. */
export const decodeDocImportPreview = (value: unknown): TDocImportPreview => {
  const input = record(value, 'preview')
  const counts = record(input.counts, 'preview.counts')
  const sourceInfo = record(input.sourceInfo, 'preview.sourceInfo')
  const configPaths = array(sourceInfo.configPaths, 'preview.sourceInfo.configPaths')
  const conflicts = array(input.conflicts, 'preview.conflicts')

  return {
    conflicts: conflicts.map((conflict, index) => record(conflict, `preview.conflicts[${index}]`)),
    counts: {
      assets: integer(counts.assets, 'preview.counts.assets'),
      groups: integer(counts.groups, 'preview.counts.groups'),
      links: integer(counts.links, 'preview.counts.links'),
      pages: integer(counts.pages, 'preview.counts.pages'),
      tabs: integer(counts.tabs, 'preview.counts.tabs'),
    },
    badSmells: decodeBadSmells(input.badSmells, 'preview.badSmells'),
    expiresAt: string(input.expiresAt, 'preview.expiresAt', 64),
    previewRef: string(input.previewRef, 'preview.previewRef', 128),
    schemaVersion: literal(
      input.schemaVersion,
      DOC_IMPORT_PREVIEW_SCHEMA_VERSION,
      'preview.schemaVersion',
    ),
    sourceInfo: {
      branch: string(sourceInfo.branch, 'preview.sourceInfo.branch', 256),
      commit: string(sourceInfo.commit, 'preview.sourceInfo.commit', 64),
      configPaths: configPaths.map((item, index) =>
        string(item, `preview.sourceInfo.configPaths[${index}]`, 1_024),
      ),
      contentRoot: string(sourceInfo.contentRoot, 'preview.sourceInfo.contentRoot', 1_024),
      framework: string(sourceInfo.framework, 'preview.sourceInfo.framework', 64),
      repo: string(sourceInfo.repo, 'preview.sourceInfo.repo', 512),
      repoUrl: string(sourceInfo.repoUrl, 'preview.sourceInfo.repoUrl', 2_048),
    },
    targetRevision: string(input.targetRevision, 'preview.targetRevision', 512),
    targetTree: record(input.targetTree, 'preview.targetTree'),
    tree: decodeSourceTree(input.tree, PREVIEW_TREE_LIMITS),
  }
}
