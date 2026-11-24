/**
 * Projects durable Workflow and PreviewStore facts into the coarse UI process.
 *
 *   no run        -> analyzing / queued
 *   run pending   -> analyzing / queued
 *   Dataset       -> building_preview / running
 *   ready receipt -> building_preview / completed
 *   failed run    -> current stage / failed
 *
 * @see docs/import/import-process-log.md
 */
import type { PreviewStore, TPreviewRecord } from '../preview-store'
import type { TImportProcess } from './contract'

export type TPreviewProcessProjection = {
  error?: { code: 'preview_analysis_failed'; message: string }
  process: TImportProcess
  status: 'failed' | 'queued' | 'ready' | 'running'
}

const DEFAULT_ANALYSIS_ERROR = 'Repository analysis failed.'

type TWorkflowStatusReader = {
  status: (workflowRunRef: string) => Promise<{
    status: 'cancelled' | 'complete' | 'errored' | 'pending' | 'queued' | 'running' | 'waiting'
    error?: { message: string }
  }>
}

/** Derives Preview status without introducing a second mutable process store. */
export const projectPreviewProcess = async (
  store: PreviewStore,
  record: TPreviewRecord,
  workflowStatus: TWorkflowStatusReader,
): Promise<TPreviewProcessProjection> => {
  const [ready, dataset, analysisRun] = await Promise.all([
    store.getReady(record.previewRef, record.attemptRef),
    store.getDataset(record.previewRef, record.attemptRef),
    store.getAnalysisRun(record.previewRef),
  ])
  const stage = dataset ? 'building_preview' : 'analyzing'
  const updatedAt = analysisRun?.createdAt ?? record.createdAt

  if (ready) {
    return {
      process: { recentBatch: [], stage: 'building_preview', state: 'completed', updatedAt },
      status: 'ready',
    }
  }

  if (!analysisRun) {
    return {
      process: { recentBatch: [], stage: 'analyzing', state: 'queued', updatedAt },
      status: 'queued',
    }
  }

  const run = await workflowStatus.status(analysisRun.workflowRunRef)
  if (run.status === 'errored' || run.status === 'cancelled') {
    const message =
      run.status === 'errored'
        ? run.error?.message || DEFAULT_ANALYSIS_ERROR
        : 'Repository analysis was cancelled.'
    return {
      error: { code: 'preview_analysis_failed', message },
      process: { recentBatch: [], stage, state: 'failed', updatedAt },
      status: 'failed',
    }
  }

  return {
    process: {
      recentBatch: [],
      stage,
      state: run.status === 'pending' || run.status === 'queued' ? 'queued' : 'running',
      updatedAt,
    },
    status: run.status === 'pending' || run.status === 'queued' ? 'queued' : 'running',
  }
}
