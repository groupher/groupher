/**
 * Framework-neutral Docs source analyzer.
 *
 *   SourceWorkspace
 *        |
 *        +--> detect framework -> framework adapter -> SourceTree
 *        |
 *        `--> shared document parser -----------> SourceAnalysis.documents
 *
 * Framework adapters own source navigation syntax only. Shared document and
 * contract normalization must stay outside adapters.
 *
 * @see docs/bulk-import/bulk-import.md
 * @see docs/bulk-import/content-import-architecture.md
 * @see docs/bulk-import/markdown-title-normalization.md
 */
import { createHash } from 'node:crypto'

import { DocsImportError } from '../../../core/errors'
import {
  SOURCE_ANALYSIS_SCHEMA_VERSION,
  type TSourceAnalysis,
  type TSourceTree,
  type TSourceWorkspace,
} from '../contracts'
import { detectFramework } from './detectFramework'
import { loadDocuments } from './documentFile'
import { analyzeDocusaurus } from './frameworks/docusaurus'
import { analyzeFumadocs } from './frameworks/fumadocs'
import { analyzeMkDocs } from './frameworks/mkdocs'
import { analyzeNextra } from './frameworks/nextra'
import { analyzeRspress } from './frameworks/rspress'
import { analyzeStarlight } from './frameworks/starlight'
import { analyzeVitePress } from './frameworks/vitepress'

const analyzers = {
  docusaurus: analyzeDocusaurus,
  fumadocs: analyzeFumadocs,
  mkdocs: analyzeMkDocs,
  nextra: analyzeNextra,
  rspress: analyzeRspress,
  starlight: analyzeStarlight,
  vitepress: analyzeVitePress,
} as const

/** Detects the source framework and returns canonical SourceTree and document metadata. */
export const analyzeSourceWorkspace = async (
  workspace: TSourceWorkspace,
): Promise<TSourceAnalysis> => {
  const framework = detectFramework(workspace)
  if (!framework) {
    throw new DocsImportError(
      'unsupported_framework',
      'analyzing',
      'The repository does not contain a supported documentation framework.',
    )
  }
  const tree: TSourceTree = await analyzers[framework](workspace)
  const documents = await loadDocuments(workspace, tree.source.root)

  return {
    badSmells: [],
    documents: await Promise.all(
      Array.from(documents.values()).map(async (document) => {
        const markdown = await workspace.readText(document.sourcePath)
        return {
          contentHash: `source-md-v1:${createHash('sha256').update(markdown).digest('hex')}`,
          metadataTitle: document.metadataTitle,
          route: document.route,
          sizeBytes:
            workspace.files.find((file) => file.path === document.sourcePath)?.sizeBytes ?? 0,
          sourceRef: document.sourcePath,
          title: document.title,
          titleSource: document.titleSource,
        }
      }),
    ),
    schemaVersion: SOURCE_ANALYSIS_SCHEMA_VERSION,
    tree,
  }
}

export { detectFramework }
