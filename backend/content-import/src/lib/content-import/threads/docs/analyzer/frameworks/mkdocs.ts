/**
 * Adapts Mkdocs sources into the canonical Docs import tree.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import YAML from 'yaml'

import type { TSourceNode, TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadDocuments, type TDocumentMetadata } from '../documentFile'
import { asRecord, directoryTree, linkNode, pageNode, scopeNode, sectionNode } from '../helpers'

const navItems = (
  value: unknown,
  root: string,
  documents: Map<string, TDocumentMetadata>,
  parentId: string,
): TSourceNode[] =>
  (Array.isArray(value) ? value : []).flatMap((item): TSourceNode[] => {
    if (typeof item === 'string') {
      const document = documents.get(`${root}/${item}`)
      return document ? [pageNode(document)] : []
    }
    const record = asRecord(item)
    if (!record) return []
    return Object.entries(record).flatMap(([title, target]): TSourceNode[] => {
      if (typeof target === 'string' && /^https?:\/\//.test(target))
        return [linkNode(title, target)]
      if (typeof target === 'string') {
        const document = documents.get(`${root}/${target}`)
        return document ? [pageNode(document, title)] : []
      }
      return [
        sectionNode(
          `nav:${title.toLowerCase()}`,
          title,
          navItems(target, root, documents, parentId),
        ),
      ]
    })
  })

/** Maps MkDocs YAML nav and docs_dir configuration into canonical SourceTree.
 *
 * @see docs/bulk-import/bulk-import.md
 */
export const analyzeMkDocs = async (workspace: TSourceWorkspace): Promise<TSourceTree> => {
  const configPath = workspace.files
    .map((file) => file.path)
    .find((file) => /^mkdocs\.ya?ml$/.test(file))!
  const config = asRecord(YAML.parse(await workspace.readText(configPath)))
  const root = typeof config?.docs_dir === 'string' ? config.docs_dir : 'docs'
  const documents = await loadDocuments(workspace, root)
  const navigation = Array.isArray(config?.nav)
    ? [
        scopeNode(
          'nav:docs',
          'Docs',
          '/',
          navItems(config.nav, root, documents, 'nav:docs').map((item) =>
            item.type === 'page' && item.sourcePath === `${root}/index.md`
              ? { ...item, route: '/index' }
              : item,
          ),
        ),
      ]
    : directoryTree(root, documents)

  return {
    navigation,
    schemaVersion: 2,
    source: { configPaths: [configPath], framework: 'mkdocs', root },
  }
}
