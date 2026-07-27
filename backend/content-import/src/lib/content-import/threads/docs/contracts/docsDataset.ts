/**
 * Typed DocsDataset manifest decoder for immutable Preview artifacts.
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import type {
  TArtifactRef,
  TThreadDatasetHeader,
  TThreadDatasetRefs,
} from '../../../core/contracts'
import { array, literal, optionalBoolean, optionalString, record, string } from './decoder'
import type { TDocImportSourceInfo } from './sourceInfo'

export type TDocsDataset = TThreadDatasetHeader &
  TThreadDatasetRefs & {
    actorsRef?: TArtifactRef
    assetsRef?: TArtifactRef
    commentsRef?: TArtifactRef
    reactionsRef?: TArtifactRef
    sourceInfo: TDocImportSourceInfo
  }

/** Decodes artifact refs, capabilities, source identity, and Docs source metadata. */
export const decodeDocsDataset = (value: unknown): TDocsDataset => {
  const input = record(value, 'docsDataset')
  const capabilities = record(input.capabilities, 'docsDataset.capabilities')
  const source = record(input.source, 'docsDataset.source')
  const sourceInfo = record(input.sourceInfo, 'docsDataset.sourceInfo')
  const configPaths = array(sourceInfo.configPaths, 'docsDataset.sourceInfo.configPaths')
  const requiredCapability = (name: keyof TDocsDataset['capabilities']): boolean => {
    const value = optionalBoolean(capabilities[name], `docsDataset.capabilities.${name}`)
    if (value === undefined) throw new Error(`docsDataset.capabilities.${name}: expected a boolean`)
    return value
  }

  return {
    actorsRef: optionalString(input.actorsRef, 'docsDataset.actorsRef'),
    analysisRef: string(input.analysisRef, 'docsDataset.analysisRef'),
    assetsRef: optionalString(input.assetsRef, 'docsDataset.assetsRef'),
    badSmellsRef: string(input.badSmellsRef, 'docsDataset.badSmellsRef'),
    bodiesRef: string(input.bodiesRef, 'docsDataset.bodiesRef'),
    capabilities: {
      actors: requiredCapability('actors'),
      assets: requiredCapability('assets'),
      comments: requiredCapability('comments'),
      reactions: requiredCapability('reactions'),
      replies: requiredCapability('replies'),
    },
    commentsRef: optionalString(input.commentsRef, 'docsDataset.commentsRef'),
    datasetRef: string(input.datasetRef, 'docsDataset.datasetRef', 128),
    reactionsRef: optionalString(input.reactionsRef, 'docsDataset.reactionsRef'),
    schemaVersion: literal(input.schemaVersion, 1, 'docsDataset.schemaVersion'),
    source: {
      type: literal(source.type, 'repo', 'docsDataset.source.type'),
      platform: literal(source.platform, 'github', 'docsDataset.source.platform'),
      revision: string(source.revision, 'docsDataset.source.revision', 128),
      scopeRef: string(source.scopeRef, 'docsDataset.source.scopeRef', 512),
    },
    sourceInfo: {
      branch: string(sourceInfo.branch, 'docsDataset.sourceInfo.branch', 256),
      commit: string(sourceInfo.commit, 'docsDataset.sourceInfo.commit', 128),
      configPaths: configPaths.map((path, index) =>
        string(path, `docsDataset.sourceInfo.configPaths[${index}]`, 1_024),
      ),
      contentRoot: string(sourceInfo.contentRoot, 'docsDataset.sourceInfo.contentRoot', 1_024),
      framework: string(sourceInfo.framework, 'docsDataset.sourceInfo.framework', 64),
      repo: string(sourceInfo.repo, 'docsDataset.sourceInfo.repo', 512),
      repoUrl: string(sourceInfo.repoUrl, 'docsDataset.sourceInfo.repoUrl', 2_048),
    },
    thread: literal(input.thread, 'doc', 'docsDataset.thread'),
    treeRef: string(input.treeRef, 'docsDataset.treeRef'),
  }
}
