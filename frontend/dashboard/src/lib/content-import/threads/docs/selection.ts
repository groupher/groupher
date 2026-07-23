import { DocsImportError } from '../../core/errors'
/**
 * Applies user page selection without losing required navigation ancestors.
 *
 *   selected page refs -> filtered documents + pruned SourceTree + sibling links
 *
 * @see docs/bulk-import/bulk-import.md
 */
import type { TSourceAnalysis, TSourceNode } from './contracts'

type TSelectedAnalysis = {
  analysis: TSourceAnalysis
  sourceRefs: string[]
}

const selectedPagePaths = (
  nodes: TSourceNode[],
  requestedIds: Set<string>,
): Map<string, string> => {
  const selected = new Map<string, string>()
  const knownPageIds = new Set<string>()
  const visit = (node: TSourceNode): void => {
    if (node.kind === 'page') {
      knownPageIds.add(node.sourceId)
      if (requestedIds.has(node.sourceId)) selected.set(node.sourceId, node.sourcePath)
      return
    }
    if (node.kind === 'scope' || node.kind === 'section') {
      for (const child of node.children) visit(child)
    }
  }

  for (const node of nodes) visit(node)
  const unknownIds = Array.from(requestedIds).filter((sourceId) => !knownPageIds.has(sourceId))
  if (unknownIds.length > 0) {
    throw new DocsImportError(
      'invalid_selection',
      'preview',
      `The selection contains unknown documents: ${unknownIds.slice(0, 3).join(', ')}.`,
    )
  }
  return selected
}

const containsSelectedPage = (node: TSourceNode, selectedIds: Set<string>): boolean => {
  if (node.kind === 'page') return selectedIds.has(node.sourceId)
  if (node.kind === 'link') return false
  return node.children.some((child) => containsSelectedPage(child, selectedIds))
}

const pruneNode = (node: TSourceNode, selectedIds: Set<string>): TSourceNode | null => {
  if (node.kind === 'page') return selectedIds.has(node.sourceId) ? node : null
  if (node.kind === 'link') return node
  if (!containsSelectedPage(node, selectedIds)) return null

  const children = node.children.flatMap((child): TSourceNode[] => {
    if (child.kind === 'link') return [child]
    const selected = pruneNode(child, selectedIds)
    return selected ? [selected] : []
  })
  return { ...node, children }
}

/** Returns the selected documents and their structurally valid SourceTree projection. */
export const selectSourceAnalysis = (
  analysis: TSourceAnalysis,
  selectedSourceIds: string[],
): TSelectedAnalysis => {
  const requestedIds = new Set(selectedSourceIds)
  if (requestedIds.size === 0) {
    throw new DocsImportError(
      'invalid_selection',
      'preview',
      'Select at least one document to import.',
    )
  }

  const selectedPages = selectedPagePaths(analysis.tree.navigation, requestedIds)
  const selectedPaths = new Set(selectedPages.values())
  const documents = analysis.documents.filter((document) => selectedPaths.has(document.sourceRef))
  if (documents.length !== selectedPaths.size) {
    throw new DocsImportError(
      'invalid_selection',
      'preview',
      'One or more selected documents are missing from the preview.',
    )
  }

  const navigation = analysis.tree.navigation.flatMap((node): TSourceNode[] => {
    if (node.kind === 'link') return []
    const selected = pruneNode(node, requestedIds)
    return selected ? [selected] : []
  })

  return {
    analysis: {
      ...analysis,
      documents,
      tree: { ...analysis.tree, navigation },
    },
    sourceRefs: documents.map((document) => document.sourceRef),
  }
}
