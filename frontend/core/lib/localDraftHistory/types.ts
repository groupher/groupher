/**
 * Defines the host-neutral contracts for recoverable local article drafts.
 *
 *   thread editor -> adapter payload -> LocalDraftHistory repository -> IndexedDB
 *                                            |
 *                                            `-> recovery UI
 */

export const LOCAL_DRAFT_SCHEMA_VERSION = 1

export type TLocalDraftThread = 'post' | 'blog' | 'changelog' | 'doc'

export type TLocalDraftWorkspaceIdentity = {
  accountId: string
  communityId: string
  thread: TLocalDraftThread
  articleId: string
  branchId: string | null
}

export type TLocalDraftPayload = {
  title: string
  digest?: string | null
  slug?: string | null
  body: unknown
  fields?: Record<string, unknown>
  tagIds?: string[]
  cover?: {
    assetIds: string[]
    editState?: unknown
  } | null
}

export type TLocalDraftRecordBase = TLocalDraftWorkspaceIdentity & {
  schemaVersion: number
  workspaceKey: string
  accountId: string
  baseRevisionId: string | null
  baseServerDraftVersion: number
  baseServerContentHash: string
  localPayloadHash: string
  byteSize: number
  payload: TLocalDraftPayload
}

export type TLocalDraftWorkingCopy = TLocalDraftRecordBase & {
  dirty: boolean
  writerSessionId: string
  updatedAt: number
}

export type TLocalDraftRecoveryPoint = TLocalDraftRecordBase & {
  id: string
  createdAt: number
  expiresAt: number
}

export type TLocalDraftUsage = {
  scopeKey: string
  schemaVersion: number
  accountId: string
  byteSize: number
  recoveryPointCount: number
  updatedAt: number
}

export type TLocalDraftWriteInput = TLocalDraftWorkspaceIdentity & {
  baseRevisionId?: string | null
  baseServerDraftVersion: number
  baseServerContentHash: string
  payload: TLocalDraftPayload
  writerSessionId: string
}

export type TLocalDraftInspection =
  | { status: 'none' }
  | { status: 'synced'; workingCopy: TLocalDraftWorkingCopy }
  | { status: 'local-only'; workingCopy: TLocalDraftWorkingCopy }
  | { status: 'divergent'; workingCopy: TLocalDraftWorkingCopy }

export type TLocalDraftAvailability =
  | { available: true }
  | { available: false; reason: 'unsupported' | 'quota' | 'storage-error' }

export type TLocalDraftRepositoryOptions = {
  databaseName?: string
  now?: () => number
  createId?: () => string
  maxPointsPerWorkspace?: number
  maxBytesPerWorkspace?: number
  maxBytesPerAccount?: number
  expiresAfterMs?: number
  cleanupBatchSize?: number
}
