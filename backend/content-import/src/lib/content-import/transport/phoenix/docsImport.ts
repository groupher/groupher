/**
 * Typed Node-to-Phoenix transport for Docs import validation and execution.
 *
 *   SourceTree --preview query--> TargetTree + targetRevision
 *   confirmed Preview ----------> ImportJob
 *   BodyBag batches ------------> staged Job items
 *   ready Job ------------------> atomic Doc Writer
 *
 * This module owns GraphQL request shape and byte limits only; it does not
 * parse source files or decide target-tree semantics.
 *
 * @see docs/bulk-import/content-import-architecture.md
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import type { TArtimentBodyBag } from '@groupher/artiment-publisher'

import {
  requestGroupherGraphQL,
  type TGroupherGraphQLOptions as TRequestOptions,
} from '../../../groupherGraphql'
import type { TDocImportPreview, TSourceAnalysis } from '../../threads/docs/contracts'

export const MAX_BATCH_COUNT = 4
export const MAX_BATCH_BYTES = 6 * 1024 * 1024
export const MAX_BODY_BAG_BYTES = 5 * 1024 * 1024

/** Checks the community-scoped `doc.import` permission before creating a Preview. */
export const checkDocImportPassport = async (
  community: string,
  options: TRequestOptions & { backendToken: string },
): Promise<boolean> => {
  const data = await requestGroupherGraphQL<{ checkPassport: boolean }>(
    `query CheckDocImportPassport($community: String!, $action: String!) {
      checkPassport(community: $community, action: $action)
    }`,
    { action: 'doc.import', community },
    options,
  )
  return data.checkPassport
}

export type TTargetPreview = {
  conflicts: Array<Record<string, unknown>>
  counts: TDocImportPreview['counts']
  targetRevision: string
  targetTree: Record<string, unknown>
}

export type TSourceInfo = TDocImportPreview['sourceInfo']

/** Sends SourceTree to Phoenix for read-only TargetTree planning and revision capture. */
export const previewDocImportTarget = async (
  community: string,
  sourceInfo: TSourceInfo,
  analysis: TSourceAnalysis,
  options: TRequestOptions & { serviceIdentity: string },
): Promise<TTargetPreview> => {
  const data = await requestGroupherGraphQL<{ previewDocContentImportTarget: TTargetPreview }>(
    `query PreviewDocContentImportTarget(
      $community: String!
      $sourceInfo: ContentImportSourcePreviewInput!
      $tree: Json!
    ) {
      previewDocContentImportTarget(community: $community, sourceInfo: $sourceInfo, tree: $tree) {
        targetTree conflicts targetRevision
        counts { tabs groups pages links assets }
      }
    }`,
    { community, sourceInfo, tree: JSON.stringify(analysis.tree) },
    options,
  )
  return data.previewDocContentImportTarget
}

export type TStartedImportJob = {
  id: string
  status: string
}

export type TDocImportBody = {
  bodyBag: TArtimentBodyBag
  externalRef: string
}

export type TDocImportSkipped = {
  externalRef: string
  skipped: { code: 'content_too_large' }
}

export type TDocImportIssue = {
  code: string
  externalRef: string
  message: string
  stage: 'source' | 'conversion' | 'validation'
}

export type TDocImportFailed = {
  externalRef: string
  failed: Omit<TDocImportIssue, 'externalRef'>
}

export type TDocImportStageItem = TDocImportBody | TDocImportSkipped | TDocImportFailed

export type TDocImportBodyStageResult = {
  failedItems: TDocImportIssue[]
  jobRef: string
  progress: Record<string, unknown>
  skipped: TDocImportIssue[]
  status: string
}

export type TDocImportApplyResult = {
  counts: Record<string, number>
  firstImportedDocRef?: string | null
  jobRef: string
  targetBranch: string
  failedItems: TDocImportIssue[]
  skipped: TDocImportIssue[]
  status: string
}

/** Creates the persistent ImportJob from the confirmed Preview intent and selected documents. */
export const startDocImport = async (
  community: string,
  preview: TDocImportPreview,
  analysis: TSourceAnalysis,
  datasetRef: string,
  options: TRequestOptions & { backendToken: string; serviceIdentity: string },
): Promise<TStartedImportJob> => {
  const documents = analysis.documents.map((document) => ({
    contentHash: document.contentHash,
    route: document.route,
    sizeBytes: document.sizeBytes,
    sourcePath: document.sourceRef,
    sourceRef: document.sourceRef,
    title: document.title,
  }))
  const data = await requestGroupherGraphQL<{ startDocContentImport: TStartedImportJob }>(
    `mutation StartDocContentImport(
      $community: String!
      $previewRef: ID!
      $datasetRef: ID!
      $sourceInfo: ContentImportSourcePreviewInput!
      $targetTree: Json!
      $documents: [ContentImportSourceDocumentInput!]!
      $targetRevision: String!
      $badSmells: Json!
    ) {
      startDocContentImport(
        community: $community
        previewRef: $previewRef
        datasetRef: $datasetRef
        sourceInfo: $sourceInfo
        targetTree: $targetTree
        documents: $documents
        targetRevision: $targetRevision
        badSmells: $badSmells
      ) { id status }
    }`,
    {
      badSmells: JSON.stringify(analysis.badSmells),
      community,
      datasetRef,
      documents,
      previewRef: preview.previewRef,
      sourceInfo: preview.sourceInfo,
      targetRevision: preview.targetRevision,
      targetTree: JSON.stringify(preview.targetTree),
    },
    options,
  )
  return data.startDocContentImport
}

const STAGE_DOC_IMPORT_BODIES = `
  mutation StageDocContentImportBodies(
    $community: String!
    $jobRef: ID!
    $items: [ContentImportBodyInput!]!
  ) {
    stageDocContentImportBodies(community: $community, jobRef: $jobRef, items: $items) {
      jobRef
      status
      progress
      failedItems
      skipped
    }
  }
`

const APPLY_DOC_IMPORT = `
  mutation ApplyDocContentImport($community: String!, $jobRef: ID!) {
    applyDocContentImport(community: $community, jobRef: $jobRef) {
      jobRef
      status
      firstImportedDocRef
      targetBranch
      counts
      failedItems
      skipped
    }
  }
`

/** Measures the exact GraphQL request envelope used by the batch-size guard. */
export const stageDocImportRequestBytes = (
  community: string,
  jobRef: string,
  items: TDocImportStageItem[],
): number =>
  Buffer.byteLength(
    JSON.stringify({
      query: STAGE_DOC_IMPORT_BODIES,
      variables: { community, items, jobRef },
    }),
    'utf8',
  )

/** Stages one bounded batch of BodyBags, skips, or per-document failures in Phoenix. */
export const stageDocImportBodies = async (
  community: string,
  jobRef: string,
  items: TDocImportStageItem[],
  options: TRequestOptions & { serviceIdentity: string },
): Promise<TDocImportBodyStageResult> => {
  const data = await requestGroupherGraphQL<{
    stageDocContentImportBodies: TDocImportBodyStageResult
  }>(STAGE_DOC_IMPORT_BODIES, { community, items, jobRef }, options)
  return data.stageDocContentImportBodies
}

/** Applies a ready Job atomically after all selected items reach a terminal staging state. */
export const applyDocImport = async (
  community: string,
  jobRef: string,
  options: TRequestOptions & { serviceIdentity: string },
): Promise<TDocImportApplyResult> => {
  const data = await requestGroupherGraphQL<{ applyDocContentImport: TDocImportApplyResult }>(
    APPLY_DOC_IMPORT,
    { community, jobRef },
    options,
  )
  return data.applyDocContentImport
}

/** Marks an unfinished Job failed when workflow-level orchestration cannot continue. */
export const failDocImport = async (
  community: string,
  jobRef: string,
  code: string,
  message: string,
  options: TRequestOptions & { serviceIdentity: string },
): Promise<void> => {
  await requestGroupherGraphQL(
    `mutation FailDocContentImport(
      $community: String!
      $jobRef: ID!
      $code: String!
      $message: String!
    ) {
      failDocContentImport(
        community: $community
        jobRef: $jobRef
        code: $code
        message: $message
      ) { id status }
    }`,
    { code, community, jobRef, message },
    options,
  )
}

/** Cancels an unfinished Job and asks Phoenix to discard its staged BodyBags. */
export const cancelDocImport = async (
  community: string,
  jobRef: string,
  options: TRequestOptions & { serviceIdentity: string },
): Promise<void> => {
  await requestGroupherGraphQL(
    `mutation CancelDocContentImport($community: String!, $jobRef: ID!) {
      cancelDocContentImport(community: $community, jobRef: $jobRef) { id status }
    }`,
    { community, jobRef },
    options,
  )
}
