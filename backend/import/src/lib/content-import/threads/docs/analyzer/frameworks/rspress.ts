/**
 * Adapts Rspress sources into the canonical Docs import tree.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import type { TSourceTree, TSourceWorkspace } from '../../contracts'
import { loadTreeDocuments, type TDocumentTreeMetadata } from '../documentFile'
import { asRecord, directoryTree } from '../helpers'
import { parseStaticConfig } from '../staticConfig'
import { analyzeVitePress } from './vitepress'

const CONFIG = /^rspress\.config\.(?:[cm]?[jt]s)$/

/** Maps Rspress config and auto-navigation metadata into canonical SourceTree.
 *
 * @see docs/import/bulk-import.md
 */
export const analyzeRspress = async (
  workspace: TSourceWorkspace,
  suppliedDocuments?: ReadonlyMap<string, TDocumentTreeMetadata>,
): Promise<TSourceTree> => {
  const configPath = workspace.files.map((file) => file.path).find((file) => CONFIG.test(file))!
  const config = asRecord(parseStaticConfig(await workspace.readText(configPath), configPath))
  const root = typeof config?.root === 'string' ? config.root : 'docs'
  const viteLike = await analyzeVitePress(
    {
      ...workspace,
      files: workspace.files.map((file) =>
        file.path === configPath ? { ...file, path: `${root}/.vitepress/config.ts` } : file,
      ),
      readText: (sourcePath) =>
        workspace.readText(sourcePath === `${root}/.vitepress/config.ts` ? configPath : sourcePath),
    },
    suppliedDocuments,
  )
  if (viteLike.navigation.length > 0) {
    return {
      ...viteLike,
      source: { configPaths: [configPath], framework: 'rspress', root },
    }
  }

  return {
    navigation: directoryTree(root, await loadTreeDocuments(workspace, root, suppliedDocuments)),
    schemaVersion: 2,
    source: { configPaths: [configPath], framework: 'rspress', root },
  }
}
