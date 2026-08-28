/**
 * Adapts Starlight sources into the canonical Docs import tree.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import type { TSourceNode, TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadDocuments, type TDocumentMetadata } from '../documentFile'
import { asRecord, linkNode, pageNode, scopeNode, sectionNode } from '../helpers'
import { parseStaticConfig } from '../staticConfig'

const bySlug = (
  slug: string,
  documents: Map<string, TDocumentMetadata>,
): TDocumentMetadata | undefined =>
  Array.from(documents.values()).find(
    (document) => document.route === `/${slug}` || (!slug && document.route === '/'),
  )

/** Maps Starlight sidebar configuration and generated directories into SourceTree.
 *
 * @see docs/bulk-import/bulk-import.md
 */
export const analyzeStarlight = async (workspace: TSourceWorkspace): Promise<TSourceTree> => {
  const configPath = workspace.files
    .map((file) => file.path)
    .find((file) => /^astro\.config\.(?:js|mjs|ts)$/.test(file))!
  const config = asRecord(parseStaticConfig(await workspace.readText(configPath), configPath))
  const integrations = Array.isArray(config?.integrations) ? config.integrations : []
  const starlight = integrations.map(asRecord).find((item) => Array.isArray(item?.sidebar))
  const root = 'src/content/docs'
  const documents = await loadDocuments(workspace, root)
  const children: TSourceNode[] = []

  for (const rawItem of Array.isArray(starlight?.sidebar) ? starlight.sidebar : []) {
    const item = asRecord(rawItem)
    if (!item) continue
    const label = String(item.label || 'Untitled')
    if (typeof item.link === 'string') {
      children.push(linkNode(label, item.link))
      continue
    }
    if (typeof item.slug === 'string') {
      const document = bySlug(item.slug, documents)
      if (document) children.push(pageNode(document, label))
      continue
    }
    const generated = asRecord(item.autogenerate)
    if (typeof generated?.directory === 'string') {
      const generatedDocuments = Array.from(documents.values())
        .filter((document) => document.sourcePath.startsWith(`${root}/${generated.directory}/`))
        .sort(
          (a, b) =>
            Number(asRecord(a.frontmatter.sidebar)?.order ?? 0) -
            Number(asRecord(b.frontmatter.sidebar)?.order ?? 0),
        )
      children.push(
        sectionNode(
          `directory:${generated.directory}`,
          label,
          generatedDocuments.map((document) => pageNode(document)),
        ),
      )
      continue
    }
    if (Array.isArray(item.items)) {
      const nested = item.items.flatMap((rawChild): TSourceNode[] => {
        const child = asRecord(rawChild)
        if (!child || typeof child.slug !== 'string') return []
        const document = bySlug(child.slug, documents)
        return document ? [pageNode(document, String(child.label || document.title))] : []
      })
      children.push(sectionNode(`sidebar:${label.toLowerCase()}`, label, nested))
    }
  }

  return {
    navigation: [scopeNode('sidebar:docs', 'Docs', '/', children)],
    schemaVersion: 2,
    source: { configPaths: [configPath], framework: 'starlight', root },
  }
}
