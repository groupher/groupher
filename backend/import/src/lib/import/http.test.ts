import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GroupherGraphQLError } from '../groupherGraphql'
import type { PreviewStore, TPreviewRecord } from './core/preview-store'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  cancelJob: vi.fn(),
  checkPassport: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  getAnalysis: vi.fn(),
  getAnalysisRun: vi.fn(),
  getApplyRun: vi.fn(),
  getReady: vi.fn(),
  getRecord: vi.fn(),
  getReview: vi.fn(),
  putAnalysisRun: vi.fn(),
  putApplyRun: vi.fn(),
  startJob: vi.fn(),
  start: vi.fn(),
}))

vi.mock('./transport/phoenix/docsImport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transport/phoenix/docsImport')>()
  return {
    ...actual,
    cancelDocImport: mocks.cancelJob,
    startDocImport: mocks.startJob,
    checkDocImportPassport: mocks.checkPassport,
  }
})

import {
  handleApplyDocImportPreview,
  handleCancelDocImportPreview,
  handleCreateDocImportPreview,
  handleGetDocImportPreview,
} from './http'

const runtime = {
  store: {
    create: mocks.create,
    delete: mocks.delete,
    getAnalysis: mocks.getAnalysis,
    getAnalysisRun: mocks.getAnalysisRun,
    getApplyRun: mocks.getApplyRun,
    getReady: mocks.getReady,
    getDataset: vi.fn(),
    getRecord: mocks.getRecord,
    getReview: mocks.getReview,
    putAnalysisRun: mocks.putAnalysisRun,
    putApplyRun: mocks.putApplyRun,
  } as unknown as PreviewStore,
  workflows: {
    startAnalysis: mocks.start,
    startApply: mocks.start,
    cancel: mocks.cancel,
    status: vi.fn().mockResolvedValue({ status: 'running' }),
  },
}

const expiredRecord: TPreviewRecord = {
  attemptRef: 'att_123456',
  community: 'home',
  createdAt: '2020-01-01T00:00:00.000Z',
  expiresAt: '2020-01-01T01:00:00.000Z',
  commandId: 'request-1',
  previewRef: 'prv_01JXYZ123',
  requestedSource: {
    type: 'repo',
    platform: 'github',
    repoUrl: 'https://github.com/acme/docs',
  },
  schemaVersion: 1,
  userRef: 'user-1',
}

const authenticatedOptions = {
  backendToken: 'backend-token',
  previewSecret: 'preview-secret',
  serviceSubject: 'service:import',
  userRef: 'user-1',
}

const createRequest = (): Request =>
  new Request('https://example.test/api/docs/import/previews', {
    body: JSON.stringify({
      community: 'home',
      commandId: 'request-1',
      repoUrl: 'https://github.com/acme/docs',
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('docs import preview dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cancel.mockResolvedValue(undefined)
    mocks.checkPassport.mockResolvedValue(true)
    mocks.create.mockResolvedValue(undefined)
    mocks.delete.mockResolvedValue(undefined)
    mocks.getRecord.mockResolvedValue(null)
    mocks.putAnalysisRun.mockResolvedValue(undefined)
    mocks.start.mockResolvedValue('analysis-run')
  })

  it('deletes the PreviewRecord when workflow start fails', async () => {
    mocks.start.mockRejectedValueOnce(new Error('workflow start failed'))

    const response = await handleCreateDocImportPreview(
      createRequest(),
      authenticatedOptions,
      runtime,
    )
    const record = mocks.create.mock.calls[0]![0] as TPreviewRecord

    expect(response.status).toBe(500)
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.delete).toHaveBeenCalledWith(record.previewRef)
  })

  it('cancels the workflow before deleting the PreviewRecord when run tracking fails', async () => {
    mocks.putAnalysisRun.mockRejectedValueOnce(new Error('run tracking failed'))

    const response = await handleCreateDocImportPreview(
      createRequest(),
      authenticatedOptions,
      runtime,
    )
    const record = mocks.create.mock.calls[0]![0] as TPreviewRecord

    expect(response.status).toBe(500)
    expect(mocks.cancel).toHaveBeenCalledOnce()
    expect(mocks.delete).toHaveBeenCalledWith(record.previewRef)
    expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.delete.mock.invocationCallOrder[0]!,
    )
  })
})

describe('docs import preview expiration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cancel.mockResolvedValue(undefined)
    mocks.cancelJob.mockResolvedValue(undefined)
    mocks.delete.mockResolvedValue(undefined)
    mocks.getAnalysisRun.mockResolvedValue({ workflowRunRef: 'analysis-run' })
    mocks.getApplyRun.mockResolvedValue(null)
    mocks.getReady.mockResolvedValue(null)
  })

  it('actively deletes an expired preview and returns the unified message', async () => {
    mocks.getRecord.mockResolvedValue(expiredRecord)

    const response = await handleGetDocImportPreview(
      'prv_01JXYZ123',
      'home',
      {
        serviceSubject: 'service:import',
        userRef: 'user-1',
      },
      runtime,
    )

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'preview_expired', message: 'Preview was not found or has expired.' },
    })
    expect(mocks.cancel).toHaveBeenCalledOnce()
    expect(mocks.delete).toHaveBeenCalledWith('prv_01JXYZ123')
  })

  it('returns the same message when the preview no longer exists', async () => {
    mocks.getRecord.mockResolvedValue(null)

    const response = await handleGetDocImportPreview(
      'prv_01JXYZ123',
      'home',
      {
        serviceSubject: 'service:import',
        userRef: 'user-1',
      },
      runtime,
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'preview_not_found', message: 'Preview was not found or has expired.' },
    })
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('lets the owner delete an expired preview idempotently', async () => {
    mocks.getRecord.mockResolvedValue(expiredRecord)

    const response = await handleCancelDocImportPreview(
      'prv_01JXYZ123',
      'home',
      {
        serviceSubject: 'service:import',
        userRef: 'user-1',
      },
      runtime,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true })
    expect(mocks.delete).toHaveBeenCalledWith('prv_01JXYZ123')
  })

  it('cancels the apply workflow and persistent Job before deleting its Preview', async () => {
    mocks.getRecord.mockResolvedValue(expiredRecord)
    mocks.getApplyRun.mockResolvedValue({
      jobRef: 'job-1',
      workflowRunRef: 'apply-run',
    })

    const response = await handleCancelDocImportPreview(
      'prv_01JXYZ123',
      'home',
      {
        serviceSubject: 'service:import',
        userRef: 'user-1',
      },
      runtime,
    )

    expect(response.status).toBe(200)
    expect(mocks.cancel).toHaveBeenCalledTimes(2)
    expect(mocks.cancelJob).toHaveBeenCalledWith('home', 'job-1', {
      serviceSubject: 'service:import',
      userRef: 'user-1',
    })
    expect(mocks.cancelJob.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.delete.mock.invocationCallOrder[0]!,
    )
  })
})

describe('Docs import apply confirmation', () => {
  const previewRef = expiredRecord.previewRef
  const a = 'docs/a.md'
  const b = 'docs/b.md'
  const apply = (selectedSourceIds: string[], overwriteSourceIds?: string[], attemptRef?: string) =>
    handleApplyDocImportPreview(
      new Request('https://example.test/apply', {
        body: JSON.stringify({
          community: 'home',
          selectedSourceIds,
          overwriteSourceIds,
          attemptRef,
        }),
        method: 'POST',
      }),
      previewRef,
      authenticatedOptions,
      runtime,
    )

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRecord.mockResolvedValue({
      ...expiredRecord,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    mocks.getReview.mockResolvedValue({ previewRef })
    mocks.getReady.mockResolvedValue({ datasetRef: 'dset_123' })
    mocks.getAnalysis.mockResolvedValue({
      documents: [a, b].map((sourceRef) => ({ sourceRef })),
      tree: { navigation: [a, b].map((id) => ({ type: 'page', sourceId: id, sourcePath: id })) },
    })
    mocks.getApplyRun.mockResolvedValue(null)
    mocks.startJob.mockResolvedValue({ id: 'job-1', status: 'STAGING' })
  })

  it('checks the submitted intent with Phoenix on replay and returns the real Job status', async () => {
    mocks.getApplyRun.mockResolvedValue({
      attemptRef: expiredRecord.attemptRef,
      jobRef: 'job-1',
      workflowRunRef: 'apply-old-id',
    })
    mocks.startJob.mockResolvedValue({ id: 'job-1', status: 'COMPLETED' })

    const response = await apply([a, b], [a], expiredRecord.attemptRef)
    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toMatchObject({ jobRef: 'job-1', status: 'COMPLETED' })
    expect(mocks.startJob).toHaveBeenCalledWith(
      'home',
      { previewRef },
      expect.objectContaining({ documents: [{ sourceRef: a }, { sourceRef: b }] }),
      'dset_123',
      authenticatedOptions,
      new Set([a]),
    )
    expect(mocks.start).not.toHaveBeenCalled()

    mocks.startJob.mockRejectedValueOnce(
      new GroupherGraphQLError('Preview is bound to another selection', 'import_intent_conflict'),
    )
    const changed = await apply([b])
    expect(changed.status).toBe(409)
    await expect(changed.json()).resolves.toMatchObject({
      error: { code: 'import_intent_conflict' },
    })
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('exposes the Review attempt for confirmation', async () => {
    const response = await handleGetDocImportPreview(
      previewRef,
      'home',
      authenticatedOptions,
      runtime,
    )
    await expect(response.json()).resolves.toMatchObject({
      status: 'ready',
      preview: { previewRef, attemptRef: expiredRecord.attemptRef },
    })
  })

  it.each([
    { selected: [a], overwrite: [a], attempt: undefined },
    { selected: [a], overwrite: [a], attempt: 'att_old' },
    { selected: [b], overwrite: [], attempt: 'att_old' },
  ])(
    'rejects obsolete confirmations before creating a Job',
    async ({ selected, overwrite, attempt }) => {
      const response = await apply(selected, overwrite, attempt)
      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'preview_attempt_conflict' },
      })
      expect(mocks.startJob).not.toHaveBeenCalled()
    },
  )

  it('rejects overwrite confirmation outside the selected documents', async () => {
    const response = await apply([a], [b])
    expect(response.status).toBe(400)
    expect(mocks.startJob).not.toHaveBeenCalled()
  })

  it('tracks a cancellable Job before dispatch and retries with the same Workflow ID', async () => {
    mocks.start.mockRejectedValueOnce(new Error('dispatch timed out'))
    const first = await apply([a])
    expect(first.status).toBe(500)
    const run = mocks.putApplyRun.mock.calls[0]![1]
    expect(run).toMatchObject({
      attemptRef: expiredRecord.attemptRef,
      jobRef: 'job-1',
      workflowRunRef: 'apply-job-1',
    })
    expect(mocks.putApplyRun.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.start.mock.invocationCallOrder[0]!,
    )
    mocks.getApplyRun.mockResolvedValue(run)

    const replay = await apply([a])
    expect(replay.status).toBe(202)
    expect(mocks.start.mock.calls[0]).toEqual(mocks.start.mock.calls[1])
    expect(mocks.putApplyRun).toHaveBeenCalledOnce()
    expect(mocks.cancelJob).not.toHaveBeenCalled()
  })

  it('reuses the persisted Workflow ID for Jobs created before deterministic dispatch', async () => {
    mocks.getApplyRun.mockResolvedValue({
      attemptRef: expiredRecord.attemptRef,
      jobRef: 'job-1',
      workflowRunRef: 'apply-old-id',
    })
    const response = await apply([a])
    expect(response.status).toBe(202)
    expect(mocks.start).toHaveBeenCalledWith(
      'apply-old-id',
      expect.objectContaining({ jobRef: 'job-1', sourceRefs: [a] }),
    )
    expect(mocks.putApplyRun).not.toHaveBeenCalled()
  })
})
