/**
 * Immutable Preview artifact contract shared by HTTP handlers and workflows.
 *
 *   PreviewRecord
 *       |
 *       +-- analysis-run.json
 *       `-- attempts/{attemptRef}/
 *             |-- dataset/*
 *             |-- review/target-preview.json
 *             `-- ready.json
 *
 * A ready receipt is the completion marker. No mutable "current attempt"
 * pointer is maintained, and large source bodies stay outside workflow state.
 *
 * @see docs/bulk-import/import-file-sdk.md
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import type { TDocsDataset, TSourceAnalysis } from '../../threads/docs/contracts'
import type { TDocImportPreview } from '../../threads/docs/contracts/preview'
import { DocsImportError } from '../errors'

export const PREVIEW_TTL_MS = 60 * 60 * 1_000
export const PREVIEW_UNAVAILABLE_MESSAGE = 'Preview was not found or has expired.'
export const PREVIEW_RECORD_SCHEMA_VERSION = 1 as const
export const ANALYSIS_RUN_SCHEMA_VERSION = 1 as const
export const APPLY_RUN_SCHEMA_VERSION = 1 as const
export const READY_RECEIPT_SCHEMA_VERSION = 1 as const

export type TPreviewRecord = {
  attemptRef: string
  community: string
  createdAt: string
  expiresAt: string
  idempotencyKey: string
  previewRef: string
  requestedSource: {
    type: 'repo'
    platform: 'github'
    repoUrl: string
  }
  schemaVersion: typeof PREVIEW_RECORD_SCHEMA_VERSION
  userRef: string
}

export type TAnalysisRun = {
  attemptRef: string
  createdAt: string
  previewRef: string
  schemaVersion: typeof ANALYSIS_RUN_SCHEMA_VERSION
  workflowRunRef: string
}

export type TApplyRun = {
  attemptRef: string
  createdAt: string
  jobRef: string
  previewRef: string
  schemaVersion: typeof APPLY_RUN_SCHEMA_VERSION
  workflowRunRef: string
}

export type TReadyReceipt = {
  attemptRef: string
  datasetManifestHash: string
  datasetRef: string
  schemaVersion: typeof READY_RECEIPT_SCHEMA_VERSION
  targetPreviewHash: string
  targetRevision: string
}

export type TPreviewSource = {
  markdown: string
  sourceRef: string
}

/** Persistence boundary for attempt-scoped, immutable import artifacts. */
export interface PreviewStore {
  /** Creates the owner/source/TTL root record before workflow dispatch. */
  create(record: TPreviewRecord): Promise<void>
  /** Deletes every artifact under a Preview after cancel or expiry. */
  delete(previewRef: string): Promise<void>
  /** Reads normalized source analysis for one immutable attempt. */
  getAnalysis(previewRef: string, attemptRef: string): Promise<TSourceAnalysis | null>
  /** Reads the durable analysis Workflow association. */
  getAnalysisRun(previewRef: string): Promise<TAnalysisRun | null>
  /** Reads the durable apply Workflow and Phoenix Job association. */
  getApplyRun(previewRef: string): Promise<TApplyRun | null>
  /** Reads the typed Dataset manifest, not its source bodies. */
  getDataset(previewRef: string, attemptRef: string): Promise<TDocsDataset | null>
  /** Reads the final marker proving Dataset and target Review were persisted. */
  getReady(previewRef: string, attemptRef: string): Promise<TReadyReceipt | null>
  /** Reads the Preview owner, source request, attempt, and TTL record. */
  getRecord(previewRef: string): Promise<TPreviewRecord | null>
  /** Reads the Phoenix-validated target Review shown to the user. */
  getReview(previewRef: string, attemptRef: string): Promise<TDocImportPreview | null>
  /** Reads one raw immutable Markdown/MDX source by stable sourceRef. */
  getSource(
    previewRef: string,
    attemptRef: string,
    sourceRef: string,
  ): Promise<TPreviewSource | null>
  /** Lists root records for bounded expiry sweeping. */
  listRecords(): Promise<TPreviewRecord[]>
  /** Lists stored sourceRefs without downloading every source body. */
  listSourceRefs(previewRef: string, attemptRef: string): Promise<string[]>
  /** Writes the ready marker after all required artifacts exist. */
  markReady(previewRef: string, attemptRef: string, receipt: TReadyReceipt): Promise<void>
  /** Persists the analysis Workflow association exactly once. */
  putAnalysisRun(previewRef: string, run: TAnalysisRun): Promise<void>
  /** Persists the apply Workflow and Job association exactly once. */
  putApplyRun(previewRef: string, run: TApplyRun): Promise<void>
  /** Persists analysis, SourceTree, diagnostics, and raw sources for one attempt. */
  putDataset(
    previewRef: string,
    attemptRef: string,
    analysis: TSourceAnalysis,
    sources: TPreviewSource[],
  ): Promise<void>
  /** Persists the typed Dataset manifest after its referenced artifacts exist. */
  putManifest(previewRef: string, attemptRef: string, dataset: TDocsDataset): Promise<void>
  /** Persists the read-only target Review returned by Phoenix validation. */
  putReview(previewRef: string, attemptRef: string, preview: TDocImportPreview): Promise<void>
}

const PREVIEW_REF = /^prv_[A-Za-z0-9_-]{6,120}$/
const ATTEMPT_REF = /^att_[A-Za-z0-9_-]{6,120}$/

const requiredDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

/** Rejects Preview refs that cannot be used as bounded storage keys. */
export const assertPreviewRef = (value: string): void => {
  if (!PREVIEW_REF.test(value)) throw new Error('Invalid preview reference.')
}

/** Rejects attempt refs that cannot be used as bounded storage keys. */
export const assertAttemptRef = (value: string): void => {
  if (!ATTEMPT_REF.test(value)) throw new Error('Invalid preview attempt reference.')
}

/** Decodes the owner/source/TTL root record at the storage trust boundary. */
export const decodePreviewRecord = (value: unknown): TPreviewRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid preview record.')
  }
  const record = value as TPreviewRecord
  const source = record.requestedSource
  if (
    record.schemaVersion !== PREVIEW_RECORD_SCHEMA_VERSION ||
    !PREVIEW_REF.test(record.previewRef) ||
    !ATTEMPT_REF.test(record.attemptRef) ||
    typeof record.community !== 'string' ||
    !record.community ||
    typeof record.userRef !== 'string' ||
    !record.userRef ||
    typeof record.idempotencyKey !== 'string' ||
    !record.idempotencyKey ||
    !requiredDate(record.createdAt) ||
    !requiredDate(record.expiresAt) ||
    !source ||
    source.platform !== 'github' ||
    source.type !== 'repo' ||
    typeof source.repoUrl !== 'string' ||
    !source.repoUrl
  ) {
    throw new Error('Invalid preview record.')
  }
  return record
}

/** Decodes the immutable analysis Workflow association. */
export const decodeAnalysisRun = (value: unknown): TAnalysisRun => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid analysis run.')
  }
  const run = value as TAnalysisRun
  if (
    run.schemaVersion !== ANALYSIS_RUN_SCHEMA_VERSION ||
    !PREVIEW_REF.test(run.previewRef) ||
    !ATTEMPT_REF.test(run.attemptRef) ||
    typeof run.workflowRunRef !== 'string' ||
    !run.workflowRunRef ||
    !requiredDate(run.createdAt)
  ) {
    throw new Error('Invalid analysis run.')
  }
  return run
}

/** Decodes the immutable apply Workflow and Phoenix Job association. */
export const decodeApplyRun = (value: unknown): TApplyRun => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid apply run.')
  }
  const run = value as TApplyRun
  if (
    run.schemaVersion !== APPLY_RUN_SCHEMA_VERSION ||
    !PREVIEW_REF.test(run.previewRef) ||
    !ATTEMPT_REF.test(run.attemptRef) ||
    typeof run.jobRef !== 'string' ||
    !run.jobRef ||
    typeof run.workflowRunRef !== 'string' ||
    !run.workflowRunRef ||
    !requiredDate(run.createdAt)
  ) {
    throw new Error('Invalid apply run.')
  }
  return run
}

/** Decodes and verifies the hashes in the final ready marker. */
export const decodeReadyReceipt = (value: unknown): TReadyReceipt => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid ready receipt.')
  }
  const receipt = value as TReadyReceipt
  if (
    receipt.schemaVersion !== READY_RECEIPT_SCHEMA_VERSION ||
    !ATTEMPT_REF.test(receipt.attemptRef) ||
    typeof receipt.datasetRef !== 'string' ||
    !receipt.datasetRef ||
    typeof receipt.datasetManifestHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(receipt.datasetManifestHash) ||
    typeof receipt.targetPreviewHash !== 'string' ||
    !/^[a-f0-9]{64}$/.test(receipt.targetPreviewHash) ||
    typeof receipt.targetRevision !== 'string' ||
    !receipt.targetRevision
  ) {
    throw new Error('Invalid ready receipt.')
  }
  return receipt
}

/** Deletes expired Preview prefixes and returns the number of removed records. */
export const sweepExpiredPreviews = async (
  store: PreviewStore,
  now = new Date(),
): Promise<number> => {
  const expired = (await store.listRecords()).filter(
    (record) => new Date(record.expiresAt).getTime() <= now.getTime(),
  )
  await Promise.all(expired.map((record) => store.delete(record.previewRef)))
  return expired.length
}

/** Encodes an arbitrary source path into one safe storage-key segment. */
export const encodeSourceRef = (sourceRef: string): string =>
  Buffer.from(sourceRef, 'utf8').toString('base64url')

/** Restores the canonical sourceRef from its storage-key segment. */
export const decodeSourceRef = (encoded: string): string =>
  Buffer.from(encoded, 'base64url').toString('utf8')

/** Produces the stable artifact hash used by Dataset and ready receipts. */
export const sha256Json = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Creates a fresh attempt-scoped PreviewRecord with the fixed Preview TTL. */
export const createPreviewRecord = (
  input: Pick<TPreviewRecord, 'community' | 'idempotencyKey' | 'previewRef' | 'userRef'> & {
    repoUrl: string
  },
  now = new Date(),
): TPreviewRecord => ({
  attemptRef: `att_${crypto.randomUUID()}`,
  community: input.community,
  createdAt: now.toISOString(),
  expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS).toISOString(),
  idempotencyKey: input.idempotencyKey,
  previewRef: input.previewRef,
  requestedSource: { type: 'repo', platform: 'github', repoUrl: input.repoUrl },
  schemaVersion: PREVIEW_RECORD_SCHEMA_VERSION,
  userRef: input.userRef,
})

/** Hides cross-owner Previews behind the same not-found error used for absent refs. */
export const assertPreviewOwner = (
  record: TPreviewRecord,
  owner: Pick<TPreviewRecord, 'community' | 'userRef'>,
): void => {
  if (record.community !== owner.community || record.userRef !== owner.userRef) {
    throw new DocsImportError('preview_not_found', 'preview', PREVIEW_UNAVAILABLE_MESSAGE)
  }
}

/** Rejects a Preview after its persisted expiry boundary. */
export const assertPreviewFresh = (record: TPreviewRecord, now = new Date()): void => {
  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    throw new DocsImportError('preview_expired', 'preview', PREVIEW_UNAVAILABLE_MESSAGE)
  }
}
