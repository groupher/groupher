import { describe, expect, it } from 'vitest'

import {
  hashLocalDraftPayload,
  localDraftWorkspaceKey,
  measureLocalDraftRecord,
  serializeLocalDraftPayload,
} from './canonical'

describe('LocalDraftHistory canonical helpers', () => {
  it('isolates workspaces by account, community, and article coordinates', () => {
    const base = {
      accountId: 'user:1',
      communityId: 'community/1',
      thread: 'doc' as const,
      articleId: 'article:1',
    }

    expect(localDraftWorkspaceKey(base)).not.toBe(
      localDraftWorkspaceKey({ ...base, accountId: 'user:2' }),
    )
    expect(localDraftWorkspaceKey(base)).not.toBe(
      localDraftWorkspaceKey({ ...base, articleId: 'article-2' }),
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
      schemaVersion: 2,
      workspaceKey: 'workspace',
      accountId: 'account',
      communityId: 'community',
      thread: 'doc' as const,
      articleId: 'article',
      base: { workingCopyId: 'copy', revision: 2, snapshotId: null },
      localPayloadHash: 'local',
      payload: { title: '你好', body: [] },
    }

    expect(measureLocalDraftRecord(record)).toBe(
      new TextEncoder().encode(JSON.stringify(record)).byteLength,
    )
  })
})
