/**
 * Pure selection helpers for the Review tree.
 *
 *   SourceTree metadata + TargetTree tabs -> selectable page refs -> apply payload
 *
 * @see docs/import/bulk-import.md
 */
import type { TImportSourceNode, TImportTreeLeaf, TImportTreeNode, TImportTreeTab } from './spec'

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
    if (node.type === 'page') {
      metadata.set(node.sourceId, {
        draft: node.draft === true,
        navigationStatus: node.navigationStatus === 'unlisted' ? 'unlisted' : 'in_navigation',
        sizeBytes: node.sizeBytes,
      })
    }
    for (const child of node.pages ?? []) visit(child)
  }

  for (const node of navigation) visit(node)
  return metadata
}

/** Collects unique page sourceIds from the Phoenix-planned TargetTree tabs. */
export const pageIdsFromNodes = (
  nodes: readonly TImportTreeNode[],
  disposition?: TImportTreeLeaf['disposition'],
): string[] => {
  const ids = new Set<string>()

  const visit = (node: TImportTreeNode): void => {
    if (node.type === 'page' && (!disposition || node.disposition === disposition))
      ids.add(node.sourceId)
    if (node.type === 'group') {
      for (const child of node.pages) visit(child)
    }
  }

  for (const node of nodes) visit(node)
  return Array.from(ids)
}

/** Collects the selectable pages across tabs, optionally restricted to one Review disposition. */
export const pageIdsFromTabs = (
  tabs: TImportTreeTab[],
  disposition?: TImportTreeLeaf['disposition'],
): string[] =>
  pageIdsFromNodes(
    tabs.flatMap((tab) => tab.groups),
    disposition,
  )

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
