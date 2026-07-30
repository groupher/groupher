/**
 * Projects durable Workflow and PreviewStore facts into the coarse UI process.
 *
 *   no run        -> analyzing / queued
 *   run pending   -> analyzing / queued
 *   Dataset       -> building_preview / running
 *   ready receipt -> building_preview / completed
 *   failed run    -> current stage / failed
 *
 * @see docs/bulk-import/import-process-log.md
 */
import { getRun } from 'workflow/api'
import { WorkflowRunFailedError } from 'workflow/errors'

import type { PreviewStore, TPreviewRecord } from '../preview-store'
import type { TImportProcess } from './contract'

export type TPreviewProcessProjection = {
  error?: { code: 'preview_analysis_failed'; message: string }
  process: TImportProcess
  status: 'failed' | 'queued' | 'ready' | 'running'
}

const DEFAULT_ANALYSIS_ERROR = 'Repository analysis failed.'
const STEP_FAILURE_PREFIX = /^Step "[^"]+" failed(?: after \d+ retries)?: /u

const failedRunMessage = async (run: ReturnType<typeof getRun>): Promise<string> => {
  try {
    await run.returnValue
    return DEFAULT_ANALYSIS_ERROR
  } catch (error) {
    if (!WorkflowRunFailedError.is(error)) return DEFAULT_ANALYSIS_ERROR
    return error.cause.message.replace(STEP_FAILURE_PREFIX, '') || DEFAULT_ANALYSIS_ERROR
  }
}

/** Derives Preview status without introducing a second mutable process store. */
export const projectPreviewProcess = async (
  store: PreviewStore,
  record: TPreviewRecord,
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

  const run = getRun(analysisRun.workflowRunRef)
  const runStatus = await run.status
  if (runStatus === 'failed' || runStatus === 'cancelled') {
    const message =
      runStatus === 'failed' ? await failedRunMessage(run) : 'Repository analysis was cancelled.'
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
      state: runStatus === 'pending' ? 'queued' : 'running',
      updatedAt,
    },
    status: runStatus === 'pending' ? 'queued' : 'running',
  }
}
