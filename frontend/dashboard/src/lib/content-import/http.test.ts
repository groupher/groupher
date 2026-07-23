import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewStore, TPreviewRecord } from './core/preview-store'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  cancelJob: vi.fn(),
  checkPassport: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  getAnalysisRun: vi.fn(),
  getApplyRun: vi.fn(),
  getReady: vi.fn(),
  getRecord: vi.fn(),
  putAnalysisRun: vi.fn(),
  start: vi.fn(),
}))

vi.mock('~/config', () => ({ GRAPHQL_ENDPOINT: 'https://example.test/graphql' }))
vi.mock('~/const/serverTrust', () => ({ GROUPHER_SERVER_TRUST_HEADER: 'x-server-trust' }))
vi.mock('workflow/api', () => ({
  getRun: vi.fn(() => ({ cancel: mocks.cancel })),
  start: mocks.start,
}))
vi.mock('./transport/phoenix/docsImport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transport/phoenix/docsImport')>()
  return {
    ...actual,
    cancelDocImport: mocks.cancelJob,
    checkDocImportPassport: mocks.checkPassport,
  }
})
vi.mock('./core/preview-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./core/preview-store')>()
  return {
    ...actual,
    getPreviewStore: () =>
      ({
        create: mocks.create,
        delete: mocks.delete,
        getAnalysisRun: mocks.getAnalysisRun,
        getApplyRun: mocks.getApplyRun,
        getReady: mocks.getReady,
        getRecord: mocks.getRecord,
        putAnalysisRun: mocks.putAnalysisRun,
      }) as unknown as PreviewStore,
  }
})

import {
  handleCancelDocImportPreview,
  handleCreateDocImportPreview,
  handleGetDocImportPreview,
} from './http'

const expiredRecord: TPreviewRecord = {
  attemptRef: 'att_123456',
  community: 'home',
  createdAt: '2020-01-01T00:00:00.000Z',
  expiresAt: '2020-01-01T01:00:00.000Z',
  idempotencyKey: 'request-1',
  previewRef: 'prv_01JXYZ123',
  requestedSource: {
    kind: 'repo',
    platform: 'github',
    repoUrl: 'https://github.com/acme/docs',
  },
  schemaVersion: 1,
  userRef: 'user-1',
}

const authenticatedOptions = {
  backendToken: 'backend-token',
  previewSecret: 'preview-secret',
  serverTrustSecret: 'server-trust',
  userRef: 'user-1',
}

const createRequest = (): Request =>
  new Request('https://example.test/api/docs/import/previews', {
    body: JSON.stringify({
      community: 'home',
      idempotencyKey: 'request-1',
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
    mocks.start.mockResolvedValue({ runId: 'analysis-run' })
  })

  it('deletes the PreviewRecord when workflow start fails', async () => {
    mocks.start.mockRejectedValueOnce(new Error('workflow start failed'))

    const response = await handleCreateDocImportPreview(createRequest(), authenticatedOptions)
    const record = mocks.create.mock.calls[0]![0] as TPreviewRecord

    expect(response.status).toBe(500)
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.delete).toHaveBeenCalledWith(record.previewRef)
  })

  it('cancels the workflow before deleting the PreviewRecord when run tracking fails', async () => {
    mocks.putAnalysisRun.mockRejectedValueOnce(new Error('run tracking failed'))

    const response = await handleCreateDocImportPreview(createRequest(), authenticatedOptions)
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

    const response = await handleGetDocImportPreview('prv_01JXYZ123', 'home', {
      serverTrustSecret: 'server-trust',
      userRef: 'user-1',
    })

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'preview_expired', message: 'Preview was not found or has expired.' },
    })
    expect(mocks.cancel).toHaveBeenCalledOnce()
    expect(mocks.delete).toHaveBeenCalledWith('prv_01JXYZ123')
  })

  it('returns the same message when the preview no longer exists', async () => {
    mocks.getRecord.mockResolvedValue(null)

    const response = await handleGetDocImportPreview('prv_01JXYZ123', 'home', {
      serverTrustSecret: 'server-trust',
      userRef: 'user-1',
    })

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'preview_not_found', message: 'Preview was not found or has expired.' },
    })
    expect(mocks.delete).not.toHaveBeenCalled()
  })

  it('lets the owner delete an expired preview idempotently', async () => {
    mocks.getRecord.mockResolvedValue(expiredRecord)

    const response = await handleCancelDocImportPreview('prv_01JXYZ123', 'home', {
      serverTrustSecret: 'server-trust',
      userRef: 'user-1',
    })

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

    const response = await handleCancelDocImportPreview('prv_01JXYZ123', 'home', {
      serverTrustSecret: 'server-trust',
      userRef: 'user-1',
    })

    expect(response.status).toBe(200)
    expect(mocks.cancel).toHaveBeenCalledTimes(2)
    expect(mocks.cancelJob).toHaveBeenCalledWith('home', 'job-1', {
      serverTrustSecret: 'server-trust',
      userRef: 'user-1',
    })
    expect(mocks.cancelJob.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.delete.mock.invocationCallOrder[0]!,
    )
  })
})
