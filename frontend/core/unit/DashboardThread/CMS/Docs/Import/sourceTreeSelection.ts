/**
 * Pure selection helpers for the Review tree.
 *
 *   SourceTree metadata + TargetTree tabs -> selectable page refs -> apply payload
 *
 * @see docs/bulk-import/bulk-import.md
 */
import type { TImportSourceNode, TImportTreeTab } from './spec'

export type TImportPageMeta = {
  draft: boolean
  navigationStatus: 'in_navigation' | 'unlisted'
  sizeBytes?: number
}

/** Indexes source-only page metadata by stable sourceId for Review rendering. */
export const pageMetaFromSourceTree = (
  navigation: TImportSourceNode[],
): Map<string, TImportPageMeta> => {
  const metadata = new Map<string, TImportPageMeta>()
  const visit = (node: TImportSourceNode): void => {
    if (node.kind === 'page') {
      metadata.set(node.sourceId, {
        draft: node.draft === true,
        navigationStatus: node.navigationStatus === 'unlisted' ? 'unlisted' : 'in_navigation',
        sizeBytes: node.sizeBytes,
      })
    }
    for (const child of node.children ?? []) visit(child)
  }

  for (const node of navigation) visit(node)
  return metadata
}

/** Collects unique page sourceIds from the Phoenix-planned TargetTree tabs. */
export const pageIdsFromTabs = (tabs: TImportTreeTab[]): string[] => {
  const ids = new Set<string>()
  for (const tab of tabs) {
    for (const group of tab.groups) {
      for (const child of group.children) {
        if (child.type === 'page') ids.add(child.sourceId)
      }
    }
  }
  return Array.from(ids)
}

/** Sums known selected source sizes, or returns null when any size is unavailable. */
export const totalPageSize = (
  sourceIds: string[],
  pageMeta: ReadonlyMap<string, TImportPageMeta>,
): number | null => {
  if (sourceIds.length === 0) return null

  let total = 0
  for (const sourceId of sourceIds) {
    const sizeBytes = pageMeta.get(sourceId)?.sizeBytes
    if (sizeBytes == null) return null
    total += sizeBytes
  }
  return total
}
