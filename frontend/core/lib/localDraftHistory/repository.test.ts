import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { createLocalDraftRepository } from './repository'
import type { TLocalDraftWorkspaceIdentity, TLocalDraftWriteInput } from './types'

const identity: TLocalDraftWorkspaceIdentity = {
  accountId: 'account-1',
  communityId: 'community-1',
  thread: 'doc',
  articleId: 'article-1',
  branchId: 'main',
}

const input = (
  title: string,
  overrides: Partial<TLocalDraftWriteInput> = {},
): TLocalDraftWriteInput => ({
  ...identity,
  baseRevisionId: 'revision-1',
  baseServerDraftVersion: 3,
  baseServerContentHash: 'server-hash-1',
  payload: { title, body: [{ text: title }] },
  writerSessionId: 'writer-1',
  ...overrides,
})

const databaseName = (name: string): string =>
  `local-draft-history-test-${name}-${crypto.randomUUID()}`

describe('LocalDraftHistory repository', () => {
  it('classifies synced, local-only, and divergent working copies', async () => {
    const repository = createLocalDraftRepository({ databaseName: databaseName('inspection') })

    expect(await repository.inspectWorkingCopy(identity, 'server-hash-1')).toEqual({
      status: 'none',
    })
    expect(await repository.writeWorkingCopy(input('local edit'))).toBe(true)

    const localOnly = await repository.inspectWorkingCopy(identity, 'server-hash-1')
    expect(localOnly.status).toBe('local-only')

    const divergent = await repository.inspectWorkingCopy(identity, 'server-hash-2')
    expect(divergent.status).toBe('divergent')
  })

  it('deduplicates recovery payloads and trims the oldest point by workspace budget', async () => {
    let now = 1_000
    let id = 0
    const repository = createLocalDraftRepository({
      databaseName: databaseName('retention'),
      maxPointsPerWorkspace: 2,
      now: () => now,
      createId: () => `point-${++id}`,
    })

    expect(await repository.appendRecoveryPoint(input('one'))).toBe(true)
    now += 1
    expect(await repository.appendRecoveryPoint(input('one'))).toBe(true)
    now += 1
    expect(await repository.appendRecoveryPoint(input('two'))).toBe(true)
    now += 1
    expect(await repository.appendRecoveryPoint(input('three'))).toBe(true)

    const points = await repository.listRecoveryPoints(identity)
    expect(points.map(({ id: pointId }) => pointId)).toEqual(['point-3', 'point-2'])
  })

  it('clears one workspace without deleting another workspace owned by the account', async () => {
    const repository = createLocalDraftRepository({ databaseName: databaseName('workspace-clear') })
    const other = { ...identity, branchId: 'preview' }

    await repository.writeWorkingCopy(input('main'))
    await repository.appendRecoveryPoint(input('main point'))
    await repository.writeWorkingCopy(input('preview', other))
    await repository.appendRecoveryPoint(input('preview point', other))

    await repository.clearWorkspace(identity)

    expect(await repository.getWorkingCopy(identity)).toBeNull()
    expect(await repository.listRecoveryPoints(identity)).toEqual([])
    expect(await repository.getWorkingCopy(other)).not.toBeNull()
    expect(await repository.listRecoveryPoints(other)).toHaveLength(1)
  })

  it('clears every workspace for a signed-out account', async () => {
    const repository = createLocalDraftRepository({ databaseName: databaseName('account-clear') })
    const other = { ...identity, articleId: 'article-2' }

    await repository.writeWorkingCopy(input('first'))
    await repository.appendRecoveryPoint(input('first point'))
    await repository.writeWorkingCopy(input('second', other))
    await repository.appendRecoveryPoint(input('second point', other))
    await repository.clearAccount(identity.accountId)

    expect(await repository.getWorkingCopy(identity)).toBeNull()
    expect(await repository.getWorkingCopy(other)).toBeNull()
    expect(await repository.listRecoveryPoints(identity)).toEqual([])
    expect(await repository.listRecoveryPoints(other)).toEqual([])
  })

  it('degrades without throwing when IndexedDB is unavailable', async () => {
    const activeIndexedDB = globalThis.indexedDB
    Reflect.deleteProperty(globalThis, 'indexedDB')

    try {
      const repository = createLocalDraftRepository({ databaseName: databaseName('unsupported') })
      expect(await repository.writeWorkingCopy(input('offline'))).toBe(false)
      expect(repository.getAvailability()).toEqual({ available: false, reason: 'unsupported' })
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: activeIndexedDB,
      })
    }
  })
})
