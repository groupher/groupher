/**
 * Persists best-effort local draft recovery state without becoming a server authority.
 *
 *   editor/session -> working copy + recovery points -> IndexedDB
 *                           |
 *                           `-> usage accounting / bounded cleanup
 */

import { hashLocalDraftPayload, localDraftWorkspaceKey, measureLocalDraftRecord } from './canonical'
import {
  LOCAL_DRAFT_INDEX,
  LOCAL_DRAFT_STORE,
  openLocalDraftDatabase,
  requestResult,
  transactionDone,
} from './database'
import {
  LOCAL_DRAFT_SCHEMA_VERSION,
  type TLocalDraftAvailability,
  type TLocalDraftInspection,
  type TLocalDraftRecordBase,
  type TLocalDraftRecoveryPoint,
  type TLocalDraftRepositoryOptions,
  type TLocalDraftUsage,
  type TLocalDraftWorkingCopy,
  type TLocalDraftWorkspaceIdentity,
  type TLocalDraftWriteInput,
} from './types'

const MIB = 1024 * 1024
const DEFAULTS = {
  maxPointsPerWorkspace: 30,
  maxBytesPerWorkspace: 20 * MIB,
  maxBytesPerAccount: 100 * MIB,
  expiresAfterMs: 7 * 24 * 60 * 60 * 1000,
  cleanupBatchSize: 50,
} as const

type TContentStore = IDBObjectStore

const workspaceScopeKey = (workspaceKey: string): string => `workspace:${workspaceKey}`
const accountScopeKey = (accountId: string): string => `account:${accountId}`

const validUsage = (usage: TLocalDraftUsage | null): usage is TLocalDraftUsage =>
  !!usage &&
  usage.schemaVersion === LOCAL_DRAFT_SCHEMA_VERSION &&
  usage.byteSize >= 0 &&
  usage.recoveryPointCount >= 0

const quotaError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'QuotaExceededError'

const baseRecord = (input: TLocalDraftWriteInput): Omit<TLocalDraftRecordBase, 'byteSize'> => {
  const workspaceKey = localDraftWorkspaceKey(input)
  const withoutSize: Omit<TLocalDraftRecordBase, 'byteSize'> = {
    schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
    workspaceKey,
    accountId: input.accountId,
    communityId: input.communityId,
    thread: input.thread,
    articleId: input.articleId,
    branchId: input.branchId,
    baseRevisionId: input.baseRevisionId || null,
    baseServerDraftVersion: input.baseServerDraftVersion,
    baseServerContentHash: input.baseServerContentHash,
    localPayloadHash: hashLocalDraftPayload(input.payload),
    payload: input.payload,
  }
  return withoutSize
}

const emptyUsage = (scopeKey: string, accountId: string, now: number): TLocalDraftUsage => ({
  scopeKey,
  schemaVersion: LOCAL_DRAFT_SCHEMA_VERSION,
  accountId,
  byteSize: 0,
  recoveryPointCount: 0,
  updatedAt: now,
})

const applyUsageDelta = async (
  store: IDBObjectStore,
  scopeKey: string,
  accountId: string,
  bytes: number,
  points: number,
  now: number,
): Promise<void> => {
  const current =
    ((await requestResult(store.get(scopeKey))) as TLocalDraftUsage | undefined) ||
    emptyUsage(scopeKey, accountId, now)
  const next = {
    ...current,
    byteSize: Math.max(0, current.byteSize + bytes),
    recoveryPointCount: Math.max(0, current.recoveryPointCount + points),
    updatedAt: now,
  }
  if (next.byteSize === 0 && next.recoveryPointCount === 0) store.delete(scopeKey)
  else store.put(next)
}

const deletePoint = async (
  point: TLocalDraftRecoveryPoint,
  recoveryStore: TContentStore,
  usageStore: IDBObjectStore,
  now: number,
): Promise<void> => {
  recoveryStore.delete(point.id)
  await applyUsageDelta(
    usageStore,
    workspaceScopeKey(point.workspaceKey),
    point.accountId,
    -point.byteSize,
    -1,
    now,
  )
  await applyUsageDelta(
    usageStore,
    accountScopeKey(point.accountId),
    point.accountId,
    -point.byteSize,
    -1,
    now,
  )
}

/** Creates the IndexedDB-backed LocalDraftHistory repository used by editor adapters. */
export const createLocalDraftRepository = (options: TLocalDraftRepositoryOptions = {}) => {
  const config = { ...DEFAULTS, ...options }
  const now = options.now || Date.now
  const createId =
    options.createId ||
    (() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${now()}`))
  let availability: TLocalDraftAvailability = { available: true }

  const database = () => openLocalDraftDatabase(options.databaseName)

  const markFailure = (error: unknown): void => {
    availability = { available: false, reason: quotaError(error) ? 'quota' : 'storage-error' }
  }

  const getUsage = async (scopeKey: string): Promise<TLocalDraftUsage | null> => {
    const db = await database()
    if (!db) return null
    const transaction = db.transaction(LOCAL_DRAFT_STORE.USAGE, 'readonly')
    const result = (await requestResult(
      transaction.objectStore(LOCAL_DRAFT_STORE.USAGE).get(scopeKey),
    )) as TLocalDraftUsage | undefined
    db.close()
    return result || null
  }

  const rebuildWorkspaceUsage = async (
    workspaceKey: string,
    accountId: string,
  ): Promise<TLocalDraftUsage | null> => {
    const db = await database()
    if (!db) return null
    const transaction = db.transaction(
      [
        LOCAL_DRAFT_STORE.WORKING_COPIES,
        LOCAL_DRAFT_STORE.RECOVERY_POINTS,
        LOCAL_DRAFT_STORE.USAGE,
      ],
      'readwrite',
    )
    const working = (await requestResult(
      transaction.objectStore(LOCAL_DRAFT_STORE.WORKING_COPIES).get(workspaceKey),
    )) as TLocalDraftWorkingCopy | undefined
    const points = (await requestResult(
      transaction
        .objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
        .index(LOCAL_DRAFT_INDEX.WORKSPACE_CREATED)
        .getAll(IDBKeyRange.bound([workspaceKey, 0], [workspaceKey, Number.MAX_SAFE_INTEGER])),
    )) as TLocalDraftRecoveryPoint[]
    const row = {
      ...emptyUsage(workspaceScopeKey(workspaceKey), accountId, now()),
      byteSize:
        (working?.byteSize || 0) + points.reduce((total, point) => total + point.byteSize, 0),
      recoveryPointCount: points.length,
    }
    const usageStore = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    if (row.byteSize === 0 && row.recoveryPointCount === 0) usageStore.delete(row.scopeKey)
    else usageStore.put(row)
    await transactionDone(transaction)
    db.close()
    return row.byteSize === 0 && row.recoveryPointCount === 0 ? null : row
  }

  const rebuildAccountUsage = async (accountId: string): Promise<TLocalDraftUsage | null> => {
    const db = await database()
    if (!db) return null
    const transaction = db.transaction(
      [
        LOCAL_DRAFT_STORE.WORKING_COPIES,
        LOCAL_DRAFT_STORE.RECOVERY_POINTS,
        LOCAL_DRAFT_STORE.USAGE,
      ],
      'readwrite',
    )
    const working = (await requestResult(
      transaction
        .objectStore(LOCAL_DRAFT_STORE.WORKING_COPIES)
        .index(LOCAL_DRAFT_INDEX.ACCOUNT)
        .getAll(IDBKeyRange.only(accountId)),
    )) as TLocalDraftWorkingCopy[]
    const points = (await requestResult(
      transaction
        .objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
        .index(LOCAL_DRAFT_INDEX.ACCOUNT)
        .getAll(IDBKeyRange.only(accountId)),
    )) as TLocalDraftRecoveryPoint[]
    const row = {
      ...emptyUsage(accountScopeKey(accountId), accountId, now()),
      byteSize:
        working.reduce((total, copy) => total + copy.byteSize, 0) +
        points.reduce((total, point) => total + point.byteSize, 0),
      recoveryPointCount: points.length,
    }
    const usageStore = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    if (row.byteSize === 0 && row.recoveryPointCount === 0) usageStore.delete(row.scopeKey)
    else usageStore.put(row)
    await transactionDone(transaction)
    db.close()
    return row.byteSize === 0 && row.recoveryPointCount === 0 ? null : row
  }

  const trimExpired = async (): Promise<void> => {
    const db = await database()
    if (!db) return
    const transaction = db.transaction(
      [LOCAL_DRAFT_STORE.RECOVERY_POINTS, LOCAL_DRAFT_STORE.USAGE],
      'readwrite',
    )
    const points = transaction.objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
    const usage = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    const index = points.index(LOCAL_DRAFT_INDEX.EXPIRES_AT)
    const expired = (await requestResult(
      index.getAll(IDBKeyRange.upperBound(now()), config.cleanupBatchSize),
    )) as TLocalDraftRecoveryPoint[]
    for (const point of expired) await deletePoint(point, points, usage, now())
    await transactionDone(transaction)
    db.close()
  }

  const recoveryPointsForWorkspace = async (
    workspaceKey: string,
  ): Promise<TLocalDraftRecoveryPoint[]> => {
    const db = await database()
    if (!db) return []
    const transaction = db.transaction(LOCAL_DRAFT_STORE.RECOVERY_POINTS, 'readonly')
    const index = transaction
      .objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
      .index(LOCAL_DRAFT_INDEX.WORKSPACE_CREATED)
    const points = (await requestResult(
      index.getAll(IDBKeyRange.bound([workspaceKey, 0], [workspaceKey, Number.MAX_SAFE_INTEGER])),
    )) as TLocalDraftRecoveryPoint[]
    db.close()
    return points.filter(({ schemaVersion }) => schemaVersion === LOCAL_DRAFT_SCHEMA_VERSION)
  }

  const trimWorkspace = async (workspaceKey: string, accountId: string): Promise<void> => {
    const points = await recoveryPointsForWorkspace(workspaceKey)
    const storedUsage = await getUsage(workspaceScopeKey(workspaceKey))
    const usage = validUsage(storedUsage)
      ? storedUsage
      : await rebuildWorkspaceUsage(workspaceKey, accountId)
    let bytes = usage?.byteSize || 0
    let count = usage?.recoveryPointCount || points.length
    const removable = [...points].sort((left, right) => left.createdAt - right.createdAt)
    if (count <= config.maxPointsPerWorkspace && bytes <= config.maxBytesPerWorkspace) return

    const db = await database()
    if (!db) return
    const transaction = db.transaction(
      [LOCAL_DRAFT_STORE.RECOVERY_POINTS, LOCAL_DRAFT_STORE.USAGE],
      'readwrite',
    )
    const pointStore = transaction.objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
    const usageStore = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    while (
      removable.length > 0 &&
      (count > config.maxPointsPerWorkspace || bytes > config.maxBytesPerWorkspace)
    ) {
      const point = removable.shift()!
      await deletePoint(point, pointStore, usageStore, now())
      bytes -= point.byteSize
      count -= 1
    }
    await transactionDone(transaction)
    db.close()
  }

  const trimAccount = async (accountId: string): Promise<void> => {
    const storedUsage = await getUsage(accountScopeKey(accountId))
    const usage = validUsage(storedUsage) ? storedUsage : await rebuildAccountUsage(accountId)
    if (!usage || usage.byteSize <= config.maxBytesPerAccount) return
    const db = await database()
    if (!db) return
    const transaction = db.transaction(
      [LOCAL_DRAFT_STORE.RECOVERY_POINTS, LOCAL_DRAFT_STORE.USAGE],
      'readwrite',
    )
    const points = transaction.objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
    const usageStore = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    const candidates = (await requestResult(
      points
        .index(LOCAL_DRAFT_INDEX.ACCOUNT_CREATED)
        .getAll(IDBKeyRange.bound([accountId, 0], [accountId, Number.MAX_SAFE_INTEGER])),
    )) as TLocalDraftRecoveryPoint[]
    let bytes = usage.byteSize
    for (const point of candidates) {
      if (bytes <= config.maxBytesPerAccount) break
      await deletePoint(point, points, usageStore, now())
      bytes -= point.byteSize
    }
    await transactionDone(transaction)
    db.close()
  }

  /** Returns whether local recovery is currently usable after the latest storage operation. */
  const getAvailability = (): TLocalDraftAvailability => availability

  /** Loads the latest working copy for an editor workspace, discarding incompatible records. */
  const getWorkingCopy = async (
    identity: TLocalDraftWorkspaceIdentity,
  ): Promise<TLocalDraftWorkingCopy | null> => {
    const db = await database()
    if (!db) {
      availability = { available: false, reason: 'unsupported' }
      return null
    }
    const workspaceKey = localDraftWorkspaceKey(identity)
    const transaction = db.transaction(LOCAL_DRAFT_STORE.WORKING_COPIES, 'readonly')
    const result = (await requestResult(
      transaction.objectStore(LOCAL_DRAFT_STORE.WORKING_COPIES).get(workspaceKey),
    )) as TLocalDraftWorkingCopy | undefined
    db.close()
    if (!result || result.schemaVersion !== LOCAL_DRAFT_SCHEMA_VERSION) return null
    return result
  }

  /** Classifies a local working copy against the freshly loaded server Draft without overwriting it. */
  const inspectWorkingCopy = async (
    identity: TLocalDraftWorkspaceIdentity,
    serverContentHash: string,
  ): Promise<TLocalDraftInspection> => {
    const workingCopy = await getWorkingCopy(identity)
    if (!workingCopy) return { status: 'none' }
    if (!workingCopy.dirty) return { status: 'synced', workingCopy }
    return workingCopy.baseServerContentHash === serverContentHash
      ? { status: 'local-only', workingCopy }
      : { status: 'divergent', workingCopy }
  }

  /** Overwrites the latest dirty working copy and updates both usage scopes atomically. */
  const writeWorkingCopy = async (input: TLocalDraftWriteInput): Promise<boolean> => {
    const db = await database()
    if (!db) {
      availability = { available: false, reason: 'unsupported' }
      return false
    }
    const timestamp = now()
    const withoutSize: Omit<TLocalDraftWorkingCopy, 'byteSize'> = {
      ...baseRecord(input),
      dirty: true,
      writerSessionId: input.writerSessionId,
      updatedAt: timestamp,
    }
    const record: TLocalDraftWorkingCopy = {
      ...withoutSize,
      byteSize: measureLocalDraftRecord(withoutSize),
    }
    try {
      const transaction = db.transaction(
        [LOCAL_DRAFT_STORE.WORKING_COPIES, LOCAL_DRAFT_STORE.USAGE],
        'readwrite',
      )
      const workingCopies = transaction.objectStore(LOCAL_DRAFT_STORE.WORKING_COPIES)
      const usage = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
      const previous = (await requestResult(workingCopies.get(record.workspaceKey))) as
        | TLocalDraftWorkingCopy
        | undefined
      workingCopies.put(record)
      const delta = record.byteSize - (previous?.byteSize || 0)
      await applyUsageDelta(
        usage,
        workspaceScopeKey(record.workspaceKey),
        record.accountId,
        delta,
        0,
        timestamp,
      )
      await applyUsageDelta(
        usage,
        accountScopeKey(record.accountId),
        record.accountId,
        delta,
        0,
        timestamp,
      )
      await transactionDone(transaction)
      availability = { available: true }
      return true
    } catch (error) {
      markFailure(error)
      return false
    } finally {
      db.close()
    }
  }

  /** Appends a deduplicated recovery point, then enforces expiry and soft budgets. */
  const appendRecoveryPoint = async (input: TLocalDraftWriteInput): Promise<boolean> => {
    const base = baseRecord(input)
    const existing = await recoveryPointsForWorkspace(base.workspaceKey)
    if (existing.some(({ localPayloadHash }) => localPayloadHash === base.localPayloadHash))
      return true
    const timestamp = now()
    const withoutSize: Omit<TLocalDraftRecoveryPoint, 'byteSize'> = {
      ...base,
      id: createId(),
      createdAt: timestamp,
      expiresAt: timestamp + config.expiresAfterMs,
    }
    const record: TLocalDraftRecoveryPoint = {
      ...withoutSize,
      byteSize: measureLocalDraftRecord(withoutSize),
    }
    const persist = async (): Promise<void> => {
      const db = await database()
      if (!db) throw new DOMException('IndexedDB is unavailable', 'NotSupportedError')

      try {
        const transaction = db.transaction(
          [LOCAL_DRAFT_STORE.RECOVERY_POINTS, LOCAL_DRAFT_STORE.USAGE],
          'readwrite',
        )
        transaction.objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS).put(record)
        const usage = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
        await applyUsageDelta(
          usage,
          workspaceScopeKey(record.workspaceKey),
          record.accountId,
          record.byteSize,
          1,
          timestamp,
        )
        await applyUsageDelta(
          usage,
          accountScopeKey(record.accountId),
          record.accountId,
          record.byteSize,
          1,
          timestamp,
        )
        await transactionDone(transaction)
      } finally {
        db.close()
      }
    }

    try {
      await persist()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotSupportedError') {
        availability = { available: false, reason: 'unsupported' }
        return false
      }

      if (!quotaError(error)) {
        markFailure(error)
        return false
      }

      try {
        await trimExpired()
        await trimWorkspace(record.workspaceKey, record.accountId)
        await trimAccount(record.accountId)
        await persist()
      } catch (retryError) {
        markFailure(retryError)
        return false
      }
    }

    try {
      await trimExpired()
      await trimWorkspace(record.workspaceKey, record.accountId)
      await trimAccount(record.accountId)
      availability = { available: true }
      return true
    } catch (error) {
      markFailure(error)
      return false
    }
  }

  /** Lists newest-first recovery points for one account-isolated workspace. */
  const listRecoveryPoints = async (
    identity: TLocalDraftWorkspaceIdentity,
  ): Promise<TLocalDraftRecoveryPoint[]> => {
    await trimExpired().catch(markFailure)
    return (await recoveryPointsForWorkspace(localDraftWorkspaceKey(identity))).sort(
      (left, right) => right.createdAt - left.createdAt,
    )
  }

  /** Deletes a synced working copy while retaining independent recovery points. */
  const deleteWorkingCopy = async (identity: TLocalDraftWorkspaceIdentity): Promise<void> => {
    const existing = await getWorkingCopy(identity)
    if (!existing) return
    const db = await database()
    if (!db) return
    const transaction = db.transaction(
      [LOCAL_DRAFT_STORE.WORKING_COPIES, LOCAL_DRAFT_STORE.USAGE],
      'readwrite',
    )
    transaction.objectStore(LOCAL_DRAFT_STORE.WORKING_COPIES).delete(existing.workspaceKey)
    const usage = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    await applyUsageDelta(
      usage,
      workspaceScopeKey(existing.workspaceKey),
      existing.accountId,
      -existing.byteSize,
      0,
      now(),
    )
    await applyUsageDelta(
      usage,
      accountScopeKey(existing.accountId),
      existing.accountId,
      -existing.byteSize,
      0,
      now(),
    )
    await transactionDone(transaction)
    db.close()
  }

  /** Clears all local history for one workspace after Publish or Discard succeeds. */
  const clearWorkspace = async (identity: TLocalDraftWorkspaceIdentity): Promise<void> => {
    const workspaceKey = localDraftWorkspaceKey(identity)
    const [workingCopy, points] = await Promise.all([
      getWorkingCopy(identity),
      recoveryPointsForWorkspace(workspaceKey),
    ])
    const db = await database()
    if (!db) return
    const transaction = db.transaction(
      [
        LOCAL_DRAFT_STORE.WORKING_COPIES,
        LOCAL_DRAFT_STORE.RECOVERY_POINTS,
        LOCAL_DRAFT_STORE.USAGE,
      ],
      'readwrite',
    )
    const recoveryStore = transaction.objectStore(LOCAL_DRAFT_STORE.RECOVERY_POINTS)
    const usageStore = transaction.objectStore(LOCAL_DRAFT_STORE.USAGE)
    if (workingCopy) {
      transaction.objectStore(LOCAL_DRAFT_STORE.WORKING_COPIES).delete(workspaceKey)
      await applyUsageDelta(
        usageStore,
        workspaceScopeKey(workspaceKey),
        identity.accountId,
        -workingCopy.byteSize,
        0,
        now(),
      )
      await applyUsageDelta(
        usageStore,
        accountScopeKey(identity.accountId),
        identity.accountId,
        -workingCopy.byteSize,
        0,
        now(),
      )
    }
    for (const point of points) await deletePoint(point, recoveryStore, usageStore, now())
    await transactionDone(transaction)
    db.close()
  }

  /** Deletes every local record for the signed-out account through account indexes. */
  const clearAccount = async (accountId: string): Promise<void> => {
    const db = await database()
    if (!db) return
    const transaction = db.transaction(
      [
        LOCAL_DRAFT_STORE.WORKING_COPIES,
        LOCAL_DRAFT_STORE.RECOVERY_POINTS,
        LOCAL_DRAFT_STORE.USAGE,
      ],
      'readwrite',
    )
    for (const storeName of [
      LOCAL_DRAFT_STORE.WORKING_COPIES,
      LOCAL_DRAFT_STORE.RECOVERY_POINTS,
      LOCAL_DRAFT_STORE.USAGE,
    ]) {
      const index = transaction.objectStore(storeName).index(LOCAL_DRAFT_INDEX.ACCOUNT)
      const keys = await requestResult(index.getAllKeys(IDBKeyRange.only(accountId)))
      for (const key of keys) transaction.objectStore(storeName).delete(key)
    }
    await transactionDone(transaction)
    db.close()
  }

  return {
    appendRecoveryPoint,
    clearAccount,
    clearWorkspace,
    deleteWorkingCopy,
    getAvailability,
    getWorkingCopy,
    inspectWorkingCopy,
    listRecoveryPoints,
    trimExpired,
    writeWorkingCopy,
  }
}

export type TLocalDraftRepository = ReturnType<typeof createLocalDraftRepository>

/** Shares one stateless repository facade while opening short-lived IndexedDB transactions per call. */
export const localDraftRepository = createLocalDraftRepository()
