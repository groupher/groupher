import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Files } from 'files-sdk'
import { fs } from 'files-sdk/fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SOURCE_ANALYSIS_SCHEMA_VERSION,
  type TDocsDataset,
  type TSourceAnalysis,
} from '../../threads/docs/contracts'
import FilesPreviewStore from './filesPreviewStore'
import {
  ANALYSIS_RUN_SCHEMA_VERSION,
  APPLY_RUN_SCHEMA_VERSION,
  createPreviewRecord,
  READY_RECEIPT_SCHEMA_VERSION,
  sha256Json,
  sweepExpiredPreviews,
} from './previewStore'

const analysis: TSourceAnalysis = {
  badSmells: [],
  documents: [
    {
      contentHash: 'source-md-v1:abc',
      route: '/intro',
      sizeBytes: 7,
      sourceRef: 'docs/intro.md',
      title: 'Intro',
      titleSource: 'heading',
    },
  ],
  schemaVersion: SOURCE_ANALYSIS_SCHEMA_VERSION,
  tree: {
    navigation: [],
    schemaVersion: 2,
    source: { configPaths: [], framework: 'vitepress', root: 'docs' },
  },
}

describe('FilesPreviewStore', () => {
  let directory = ''
  let files: Files
  let store: FilesPreviewStore

  beforeEach(async () => {
    directory = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'content-import-files-'))
    files = new Files({ adapter: fs({ root: directory }), prefix: 'content-import/previews' })
    store = new FilesPreviewStore(files)
  })

  afterEach(async () => {
    await fsPromises.rm(directory, { force: true, recursive: true })
  })

  it('persists immutable attempt-scoped dataset, review, and ready artifacts', async () => {
    const record = createPreviewRecord(
      {
        community: 'home',
        idempotencyKey: 'request-1',
        previewRef: 'prv_123456',
        repoUrl: 'https://github.com/acme/docs',
        userRef: 'user-1',
      },
      new Date('2026-07-22T00:00:00Z'),
    )
    await store.create(record)
    expect(await files.exists(`_preview-records/v1/${record.previewRef}.json`)).toBe(true)
    expect(await files.exists(`${record.previewRef}/preview-record.json`)).toBe(false)
    await store.putAnalysisRun(record.previewRef, {
      attemptRef: record.attemptRef,
      createdAt: record.createdAt,
      previewRef: record.previewRef,
      schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
      workflowRunRef: 'wrun_123',
    })
    await store.putApplyRun(record.previewRef, {
      attemptRef: record.attemptRef,
      createdAt: record.createdAt,
      jobRef: 'job-123',
      previewRef: record.previewRef,
      schemaVersion: APPLY_RUN_SCHEMA_VERSION,
      workflowRunRef: 'wrun_apply_123',
    })
    await store.putDataset(record.previewRef, record.attemptRef, analysis, [
      { markdown: '# Intro', sourceRef: 'docs/intro.md' },
    ])

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
      datasetRef: 'dset_123',
      schemaVersion: 1,
      source: {
        type: 'repo',
        platform: 'github',
        revision: 'a'.repeat(40),
        scopeRef: 'acme/docs',
      },
      sourceInfo: {
        branch: 'main',
        commit: 'a'.repeat(40),
        configPaths: [],
        contentRoot: 'docs',
        framework: 'vitepress',
        repo: 'acme/docs',
        repoUrl: 'https://github.com/acme/docs',
      },
      thread: 'doc',
      treeRef: 'dataset/tree.json',
    }
    await store.putManifest(record.previewRef, record.attemptRef, dataset)

    const preview = {
      badSmells: [],
      conflicts: [],
      counts: { assets: 0, groups: 0, links: 0, pages: 1, tabs: 0 },
      expiresAt: record.expiresAt,
      previewRef: record.previewRef,
      schemaVersion: 1 as const,
      sourceInfo: {
        branch: 'main',
        commit: 'a'.repeat(40),
        configPaths: [],
        contentRoot: 'docs',
        framework: 'vitepress',
        repo: 'acme/docs',
        repoUrl: 'https://github.com/acme/docs',
      },
      targetRevision: 'doc:target:absent',
      targetTree: {},
      tree: analysis.tree,
    }
    await store.putReview(record.previewRef, record.attemptRef, preview)
    await store.markReady(record.previewRef, record.attemptRef, {
      attemptRef: record.attemptRef,
      datasetManifestHash: sha256Json(dataset),
      datasetRef: dataset.datasetRef,
      schemaVersion: READY_RECEIPT_SCHEMA_VERSION,
      targetPreviewHash: sha256Json(preview),
      targetRevision: preview.targetRevision,
    })

    expect(await store.getRecord(record.previewRef)).toEqual(record)
    expect(await store.getApplyRun(record.previewRef)).toMatchObject({
      jobRef: 'job-123',
      workflowRunRef: 'wrun_apply_123',
    })
    expect(await store.getDataset(record.previewRef, record.attemptRef)).toEqual(dataset)
    expect(await store.getReview(record.previewRef, record.attemptRef)).toEqual(preview)
    expect(await store.listSourceRefs(record.previewRef, record.attemptRef)).toEqual([
      'docs/intro.md',
    ])
    expect(await store.getReady(record.previewRef, record.attemptRef)).toMatchObject({
      datasetRef: dataset.datasetRef,
    })

    await expect(
      store.putReview(record.previewRef, record.attemptRef, {
        ...preview,
        targetRevision: 'changed',
      }),
    ).rejects.toThrow('Immutable Preview object changed')
  })

  it('deletes one preview prefix idempotently', async () => {
    const record = createPreviewRecord({
      community: 'home',
      idempotencyKey: 'request-1',
      previewRef: 'prv_123456',
      repoUrl: 'https://github.com/acme/docs',
      userRef: 'user-1',
    })
    await store.create(record)
    expect(await store.listRecords()).toEqual([record])
    await store.delete(record.previewRef)
    await store.delete(record.previewRef)
    expect(await store.getRecord(record.previewRef)).toBeNull()
    expect(await store.listRecords()).toEqual([])
  })

  it('backfills legacy root records once and then lists only the record index prefix', async () => {
    const record = createPreviewRecord({
      community: 'home',
      idempotencyKey: 'legacy-request',
      previewRef: 'prv_legacy1',
      repoUrl: 'https://github.com/acme/docs',
      userRef: 'user-1',
    })
    await files.upload(`${record.previewRef}/preview-record.json`, JSON.stringify(record), {
      contentType: 'application/json',
    })

    const listAll = vi.spyOn(files, 'listAll')
    expect(await store.listRecords()).toEqual([record])
    expect(await files.exists(`_preview-records/v1/${record.previewRef}.json`)).toBe(true)

    listAll.mockClear()
    expect(await store.listRecords()).toEqual([record])
    expect(listAll).toHaveBeenCalledTimes(1)
    expect(listAll.mock.calls[0]?.[0]).toEqual({ prefix: '_preview-records/v1/' })
  })

  it('repairs a directly read legacy record after the one-time backfill marker exists', async () => {
    const record = createPreviewRecord({
      community: 'home',
      idempotencyKey: 'late-legacy-request',
      previewRef: 'prv_legacy2',
      repoUrl: 'https://github.com/acme/docs',
      userRef: 'user-1',
    })
    await files.upload('_preview-records/v1-ready.json', JSON.stringify({ schemaVersion: 1 }), {
      contentType: 'application/json',
    })
    await files.upload(`${record.previewRef}/preview-record.json`, JSON.stringify(record), {
      contentType: 'application/json',
    })

    await expect(store.getRecord(record.previewRef)).resolves.toEqual(record)
    expect(await files.exists(`_preview-records/v1/${record.previewRef}.json`)).toBe(true)
  })

  it('bounds concurrent expiry deletion', async () => {
    const records = Array.from({ length: 20 }, (_, index) =>
      createPreviewRecord(
        {
          community: 'home',
          idempotencyKey: `request-${index}`,
          previewRef: `prv_scale_${index}`,
          repoUrl: 'https://github.com/acme/docs',
          userRef: 'user-1',
        },
        new Date('2026-07-22T00:00:00Z'),
      ),
    )
    await Promise.all(records.map((record) => store.create(record)))

    const originalDelete = store.delete.bind(store)
    let activeDeletes = 0
    let maxDeletes = 0
    vi.spyOn(store, 'delete').mockImplementation(async (previewRef) => {
      activeDeletes += 1
      maxDeletes = Math.max(maxDeletes, activeDeletes)
      try {
        await new Promise((resolve) => setTimeout(resolve, 5))
        await originalDelete(previewRef)
      } finally {
        activeDeletes -= 1
      }
    })

    await expect(sweepExpiredPreviews(store, new Date('2027-01-01T00:00:00Z'))).resolves.toBe(20)
    expect(maxDeletes).toBeGreaterThan(1)
    expect(maxDeletes).toBeLessThanOrEqual(8)
  })

  it('serializes concurrent local writes and preserves the first immutable value', async () => {
    const record = createPreviewRecord({
      community: 'home',
      idempotencyKey: 'request-1',
      previewRef: 'prv_123456',
      repoUrl: 'https://github.com/acme/docs',
      userRef: 'user-1',
    })
    await store.create(record)

    const preview = {
      badSmells: [],
      conflicts: [],
      counts: { assets: 0, groups: 0, links: 0, pages: 0, tabs: 0 },
      expiresAt: record.expiresAt,
      previewRef: record.previewRef,
      schemaVersion: 1 as const,
      sourceInfo: {
        branch: 'main',
        commit: 'a'.repeat(40),
        configPaths: [],
        contentRoot: 'docs',
        framework: 'vitepress',
        repo: 'acme/docs',
        repoUrl: 'https://github.com/acme/docs',
      },
      targetRevision: 'doc:target:absent',
      targetTree: {},
      tree: analysis.tree,
    }

    const results = await Promise.allSettled([
      store.putReview(record.previewRef, record.attemptRef, preview),
      store.putReview(record.previewRef, record.attemptRef, {
        ...preview,
        targetRevision: 'changed',
      }),
    ])

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected'])
    expect(await store.getReview(record.previewRef, record.attemptRef)).toEqual(preview)
  })
})
