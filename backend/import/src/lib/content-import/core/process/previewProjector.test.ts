import { describe, expect, it, vi } from 'vitest'

import type { PreviewStore, TPreviewRecord } from '../preview-store'
import { projectPreviewProcess } from './previewProjector'

const runningStatus = { status: vi.fn(async () => ({ status: 'running' as const })) }

const record: TPreviewRecord = {
  attemptRef: 'att_123456',
  community: 'home',
  createdAt: '2026-07-22T08:00:00.000Z',
  expiresAt: '2026-07-22T09:00:00.000Z',
  commandId: 'request-1',
  previewRef: 'prv_123456',
  requestedSource: {
    type: 'repo',
    platform: 'github',
    repoUrl: 'https://github.com/acme/docs',
  },
  schemaVersion: 1,
  userRef: 'user-1',
}

const createStore = (overrides: Record<string, unknown> = {}): PreviewStore =>
  ({
    getAnalysisRun: vi.fn().mockResolvedValue(null),
    getDataset: vi.fn().mockResolvedValue(null),
    getReady: vi.fn().mockResolvedValue(null),
    ...overrides,
  }) as unknown as PreviewStore

describe('projectPreviewProcess', () => {
  it('projects a preview without an analysis run as queued analysis', async () => {
    const projection = await projectPreviewProcess(createStore(), record, runningStatus)

    expect(projection).toEqual({
      process: {
        recentBatch: [],
        stage: 'analyzing',
        state: 'queued',
        updatedAt: record.createdAt,
      },
      status: 'queued',
    })
    expect(runningStatus.status).not.toHaveBeenCalled()
  })

  it('uses dataset existence to expose the coarse building preview stage', async () => {
    const createdAt = '2026-07-22T08:00:01.000Z'
    const statusReader = { status: vi.fn(async () => ({ status: 'running' as const })) }

    const projection = await projectPreviewProcess(
      createStore({
        getAnalysisRun: vi.fn().mockResolvedValue({ createdAt, workflowRunRef: 'workflow-run-1' }),
        getDataset: vi.fn().mockResolvedValue({ datasetRef: 'dataset-1' }),
      }),
      record,
      statusReader,
    )

    expect(projection).toEqual({
      process: {
        recentBatch: [],
        stage: 'building_preview',
        state: 'running',
        updatedAt: createdAt,
      },
      status: 'running',
    })
  })

  it('lets the ready receipt override workflow state', async () => {
    const projection = await projectPreviewProcess(
      createStore({ getReady: vi.fn().mockResolvedValue({ datasetRef: 'dataset-1' }) }),
      record,
      runningStatus,
    )

    expect(projection.process).toMatchObject({
      recentBatch: [],
      stage: 'building_preview',
      state: 'completed',
    })
    expect(projection.status).toBe('ready')
    expect(runningStatus.status).not.toHaveBeenCalled()
  })

  it('keeps a failed run in the latest artifact-derived stage', async () => {
    const statusReader = {
      status: vi.fn(async () => ({
        status: 'errored' as const,
        error: { message: 'Unsupported documentation framework.' },
      })),
    }

    const projection = await projectPreviewProcess(
      createStore({
        getAnalysisRun: vi.fn().mockResolvedValue({
          createdAt: '2026-07-22T08:00:01.000Z',
          workflowRunRef: 'workflow-run-1',
        }),
        getDataset: vi.fn().mockResolvedValue({ datasetRef: 'dataset-1' }),
      }),
      record,
      statusReader,
    )

    expect(projection.process).toMatchObject({ stage: 'building_preview', state: 'failed' })
    expect(projection.status).toBe('failed')
    expect(projection.error).toEqual({
      code: 'preview_analysis_failed',
      message: 'Unsupported documentation framework.',
    })
  })

  it('falls back when a failed run cause has no readable message', async () => {
    const statusReader = {
      status: vi.fn(async () => ({ status: 'errored' as const })),
    }

    const projection = await projectPreviewProcess(
      createStore({
        getAnalysisRun: vi.fn().mockResolvedValue({
          createdAt: '2026-07-22T08:00:01.000Z',
          workflowRunRef: 'workflow-run-1',
        }),
        getDataset: vi.fn().mockResolvedValue({ datasetRef: 'dataset-1' }),
      }),
      record,
      statusReader,
    )

    expect(projection.error).toEqual({
      code: 'preview_analysis_failed',
      message: 'Repository analysis failed.',
    })
  })
})
