/**
 * Durable GitHub repository analysis workflow.
 *
 *   repo URL
 *      |
 *      v
 *   resolve -> download -> safe extract -> SourceWorkspace -> SourceAnalysis
 *                                                        |
 *                                                        v
 *                                            immutable Dataset artifacts
 *                                                        |
 *                                                        v
 *                                    Phoenix target validation -> Review -> ready
 *
 * The temporary workspace exists only inside the first step. The second step
 * reads persisted artifacts so target-validation retries never download the
 * repository again.
 *
 * @see docs/bulk-import/content-import-architecture.md
 * @see docs/bulk-import/import-file-sdk.md
 * @see docs/bulk-import/bulk-import.md
 */
import { FatalError } from 'workflow'

import { DocsImportError } from '../../../lib/content-import/core/errors'
import {
  getPreviewStore,
  READY_RECEIPT_SCHEMA_VERSION,
  sha256Json,
} from '../../../lib/content-import/core/preview-store'
import {
  extractArchiveToWorkspace,
  openGitHubArchive,
  resolveGitHubRepo,
  withTemporaryWorkspace,
} from '../../../lib/content-import/platforms/github/repo/workspace'
import { analyzeSourceWorkspace } from '../../../lib/content-import/threads/docs/analyzer'
import type {
  TDocImportPreview,
  TDocImportSourceInfo,
  TDocsDataset,
} from '../../../lib/content-import/threads/docs/contracts'
import {
  previewDocImportTarget,
  type TSourceInfo,
} from '../../../lib/content-import/transport/phoenix/docsImport'

export type TAnalyzeGitHubRepoInput = {
  attemptRef: string
  community: string
  previewRef: string
  repoUrl: string
}

const runAnalysisOperation = async (operation: () => Promise<void>): Promise<void> => {
  try {
    await operation()
  } catch (error) {
    if (error instanceof DocsImportError && !error.retryable) {
      throw new FatalError(error.message)
    }
    throw error
  }
}

const analyzeSourceStep = async (input: TAnalyzeGitHubRepoInput): Promise<void> => {
  'use step'

  await runAnalysisOperation(async () => {
    const store = getPreviewStore()
    const record = await store.getRecord(input.previewRef)
    if (!record || record.attemptRef !== input.attemptRef) {
      throw new DocsImportError('preview_not_found', 'analyzing', 'Preview record not found.')
    }

    const repo = await resolveGitHubRepo(input.repoUrl)
    const { analysis, sources } = await withTemporaryWorkspace(async (directory) => {
      const archive = await openGitHubArchive(repo)
      const extracted = await extractArchiveToWorkspace(archive, directory, repo.commit)
      const analysis = await analyzeSourceWorkspace(extracted.workspace)
      const sources: Array<{ markdown: string; sourceRef: string }> = []
      for (let index = 0; index < analysis.documents.length; index += 32) {
        sources.push(
          ...(await Promise.all(
            analysis.documents.slice(index, index + 32).map(async (document) => ({
              markdown: await extracted.workspace.readText(document.sourceRef),
              sourceRef: document.sourceRef,
            })),
          )),
        )
      }
      return { analysis, sources }
    })

    const sourceInfo: TDocImportSourceInfo = {
      branch: repo.branch,
      commit: repo.commit,
      configPaths: analysis.tree.source.configPaths,
      contentRoot: analysis.tree.source.root,
      framework: analysis.tree.source.framework,
      repo: `${repo.owner}/${repo.repo}`,
      repoUrl: repo.repoUrl,
    }
    const datasetRef = `dset_${sha256Json({
      documents: analysis.documents,
      source: sourceInfo,
      tree: analysis.tree,
    }).slice(0, 40)}`
    const dataset: TDocsDataset = {
      analysisRef: 'dataset/analysis.json',
      badSmellsRef: 'dataset/bad-smells.json',
      bodiesRef: 'dataset/bodies/',
      capabilities: {
        actors: false,
        assets: false,
        comments: false,
        reactions: false,
        replies: false,
      },
      datasetRef,
      schemaVersion: 1,
      source: {
        type: 'repo',
        platform: 'github',
        revision: repo.commit,
        scopeRef: sourceInfo.repo,
      },
      sourceInfo,
      thread: 'doc',
      treeRef: 'dataset/tree.json',
    }

    await store.putDataset(input.previewRef, input.attemptRef, analysis, sources)
    await store.putManifest(input.previewRef, input.attemptRef, dataset)
  })
}

const validateTargetStep = async (input: TAnalyzeGitHubRepoInput): Promise<void> => {
  'use step'

  await runAnalysisOperation(async () => {
    const store = getPreviewStore()
    const [record, analysis, dataset] = await Promise.all([
      store.getRecord(input.previewRef),
      store.getAnalysis(input.previewRef, input.attemptRef),
      store.getDataset(input.previewRef, input.attemptRef),
    ])
    if (!record || record.attemptRef !== input.attemptRef || !analysis || !dataset) {
      throw new DocsImportError('preview_dataset_missing', 'preview', 'Preview dataset is missing.')
    }

    const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
    if (!serverTrustSecret) throw new Error('Groupher server trust is not configured.')
    const target = await previewDocImportTarget(
      input.community,
      dataset.sourceInfo as TSourceInfo,
      analysis,
      { serverTrustSecret },
    )
    const preview: TDocImportPreview = {
      badSmells: analysis.badSmells,
      conflicts: target.conflicts,
      counts: target.counts,
      expiresAt: record.expiresAt,
      previewRef: input.previewRef,
      schemaVersion: 1,
      sourceInfo: dataset.sourceInfo,
      targetRevision: target.targetRevision,
      targetTree: target.targetTree,
      tree: analysis.tree,
    }

    await store.putReview(input.previewRef, input.attemptRef, preview)
    await store.markReady(input.previewRef, input.attemptRef, {
      attemptRef: input.attemptRef,
      datasetManifestHash: sha256Json(dataset),
      datasetRef: dataset.datasetRef,
      schemaVersion: READY_RECEIPT_SCHEMA_VERSION,
      targetPreviewHash: sha256Json(preview),
      targetRevision: preview.targetRevision,
    })
  })
}

/** Runs source analysis before target validation; ready is written only after both succeed. */
export const analyzeGitHubRepo = async (input: TAnalyzeGitHubRepoInput): Promise<void> => {
  'use workflow'

  await analyzeSourceStep(input)
  await validateTargetStep(input)
}
