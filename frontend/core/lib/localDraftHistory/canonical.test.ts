import { describe, expect, it } from 'vitest'

import {
  hashLocalDraftPayload,
  localDraftWorkspaceKey,
  measureLocalDraftRecord,
  serializeLocalDraftPayload,
} from './canonical'

describe('LocalDraftHistory canonical helpers', () => {
  it('isolates workspaces by account, branch, and article coordinates', () => {
    const base = {
      accountId: 'user:1',
      communityId: 'community/1',
      thread: 'doc' as const,
      articleId: 'article:1',
      branchId: 'main',
    }

    expect(localDraftWorkspaceKey(base)).not.toBe(
      localDraftWorkspaceKey({ ...base, accountId: 'user:2' }),
    )
    expect(localDraftWorkspaceKey(base)).not.toBe(
      localDraftWorkspaceKey({ ...base, branchId: 'preview' }),
    )
  })

  it('hashes equivalent payload objects identically', () => {
    const left = { title: 'Intro', body: { b: 2, a: 1 }, tagIds: ['one'] }
    const right = { tagIds: ['one'], body: { a: 1, b: 2 }, title: 'Intro' }

    expect(serializeLocalDraftPayload(left)).toBe(serializeLocalDraftPayload(right))
    expect(hashLocalDraftPayload(left)).toBe(hashLocalDraftPayload(right))
  })

  it('measures the complete canonical record without byteSize', () => {
    const record = {
      schemaVersion: 1,
      workspaceKey: 'workspace',
      accountId: 'account',
      communityId: 'community',
      thread: 'doc' as const,
      articleId: 'article',
      branchId: null,
      baseRevisionId: null,
      baseServerDraftVersion: 2,
      baseServerContentHash: 'server',
      localPayloadHash: 'local',
      payload: { title: '你好', body: [] },
    }

    expect(measureLocalDraftRecord(record)).toBe(
      new TextEncoder().encode(JSON.stringify(record)).byteLength,
    )
  })
})
