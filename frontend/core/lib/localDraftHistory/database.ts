/**
 * Owns the IndexedDB schema used by local draft working copies and recovery points.
 *
 *   repository operation -> one IndexedDB transaction -> content + derived usage
 */

export const LOCAL_DRAFT_DATABASE_NAME = 'groupher-local-draft-history'
export const LOCAL_DRAFT_DATABASE_VERSION = 1

export const LOCAL_DRAFT_STORE = {
  WORKING_COPIES: 'local_draft_working_copies',
  RECOVERY_POINTS: 'local_draft_recovery_points',
  USAGE: 'local_draft_usage',
} as const

export const LOCAL_DRAFT_INDEX = {
  ACCOUNT: 'account_id',
  ACCOUNT_UPDATED: 'account_id_updated_at',
  WORKSPACE_CREATED: 'workspace_key_created_at',
  ACCOUNT_CREATED: 'account_id_created_at',
  EXPIRES_AT: 'expires_at',
} as const

/** Converts an IndexedDB request into a rejecting Promise without hiding storage errors. */
export const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'))
  })

/** Resolves only after a transaction commits so callers never observe an uncommitted success. */
export const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () =>
      reject(transaction.error || new Error('IndexedDB transaction aborted'))
    transaction.onerror = () =>
      reject(transaction.error || new Error('IndexedDB transaction failed'))
  })

/** Opens and upgrades the LocalDraftHistory database, returning null when IndexedDB is absent. */
export const openLocalDraftDatabase = async (
  databaseName = LOCAL_DRAFT_DATABASE_NAME,
): Promise<IDBDatabase | null> => {
  if (typeof indexedDB === 'undefined') return null

  const request = indexedDB.open(databaseName, LOCAL_DRAFT_DATABASE_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    const workingCopies = database.createObjectStore(LOCAL_DRAFT_STORE.WORKING_COPIES, {
      keyPath: 'workspaceKey',
    })
    workingCopies.createIndex(LOCAL_DRAFT_INDEX.ACCOUNT, 'accountId')
    workingCopies.createIndex(LOCAL_DRAFT_INDEX.ACCOUNT_UPDATED, ['accountId', 'updatedAt'])

    const recoveryPoints = database.createObjectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS, {
      keyPath: 'id',
    })
    recoveryPoints.createIndex(LOCAL_DRAFT_INDEX.ACCOUNT, 'accountId')
    recoveryPoints.createIndex(LOCAL_DRAFT_INDEX.WORKSPACE_CREATED, ['workspaceKey', 'createdAt'])
    recoveryPoints.createIndex(LOCAL_DRAFT_INDEX.ACCOUNT_CREATED, ['accountId', 'createdAt'])
    recoveryPoints.createIndex(LOCAL_DRAFT_INDEX.EXPIRES_AT, 'expiresAt')

    const usage = database.createObjectStore(LOCAL_DRAFT_STORE.USAGE, { keyPath: 'scopeKey' })
    usage.createIndex(LOCAL_DRAFT_INDEX.ACCOUNT, 'accountId')
  }

  return requestResult(request)
}
