/**
 * Authenticated HTTP orchestration for the recoverable Docs import lifecycle.
 *
 * Analyze:
 *   POST preview
 *       |
 *       v
 *   PreviewRecord -> analysis Workflow -> PreviewStore ready receipt
 *
 * Apply:
 *   POST apply -> Phoenix ImportJob -> apply Workflow -> BodyBag staging -> atomic apply
 *
 * Route handlers stop at admission, ownership, workflow dispatch, and response
 * projection. Source parsing and database writes remain behind their dedicated
 * boundaries.
 *
 * @see docs/bulk-import/content-import-architecture.md
 * @see docs/bulk-import/bulk-import.md
 * @see docs/bulk-import/import-error-handling.md
 */
import { createHmac, randomUUID } from 'node:crypto'

import { getRun, start } from 'workflow/api'

import { analyzeGitHubRepo } from '../../workflows/content-import/docs/analyzeGitHubRepo'
import { applyDocsDataset } from '../../workflows/content-import/docs/applyDocsDataset'
import { DocsImportError } from './core/errors'
import {
  ANALYSIS_RUN_SCHEMA_VERSION,
  APPLY_RUN_SCHEMA_VERSION,
  assertPreviewFresh,
  assertPreviewOwner,
  createPreviewRecord,
  getPreviewStore,
  PREVIEW_UNAVAILABLE_MESSAGE,
  type PreviewStore,
  type TPreviewRecord,
} from './core/preview-store'
import { projectPreviewProcess } from './core/process/previewProjector'
import { selectSourceAnalysis } from './threads/docs/selection'
import {
  cancelDocImport,
  checkDocImportPassport,
  startDocImport,
} from './transport/phoenix/docsImport'

type TAuthenticatedOptions = {
  backendToken: string
  previewSecret: string
  serverTrustSecret: string
  userRef: string
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })

const failure = (error: unknown): Response => {
  if (error instanceof DocsImportError) {
    return json(
      {
        error: { code: error.code, message: error.message, retryable: error.retryable },
        ok: false,
      },
      error.code === 'preview_not_found' ? 404 : error.code === 'preview_expired' ? 410 : 400,
    )
  }
  return json(
    {
      error: {
        code: 'docs_import_failed',
        message: error instanceof Error ? error.message : 'Docs import failed.',
      },
      ok: false,
    },
    500,
  )
}

const body = async (request: Request): Promise<Record<string, unknown>> => {
  const value = (await request.json()) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new DocsImportError('invalid_request', 'admission', 'Request body must be an object.')
  }
  return value as Record<string, unknown>
}

const required = (value: unknown, name: string, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new DocsImportError('invalid_request', 'admission', `${name} is required.`)
  }
  return value.trim()
}

const requiredStringArray = (value: unknown, name: string, maxItems: number): string[] => {
  if (!Array.isArray(value) || value.length === 0 || value.length > maxItems) {
    throw new DocsImportError('invalid_request', 'admission', `${name} is required.`)
  }
  return Array.from(new Set(value.map((item) => required(item, name, 1_024))))
}

const discardPreview = async (
  store: PreviewStore,
  record: TPreviewRecord,
  options: Pick<TAuthenticatedOptions, 'serverTrustSecret'>,
): Promise<void> => {
  const [analysisRun, applyRun] = await Promise.all([
    store.getAnalysisRun(record.previewRef),
    store.getApplyRun(record.previewRef),
  ])
  await Promise.all(
    [analysisRun, applyRun]
      .filter((run) => run !== null)
      .map((run) =>
        getRun(run.workflowRunRef)
          .cancel()
          .catch(() => undefined),
      ),
  )
  if (applyRun) {
    await cancelDocImport(record.community, applyRun.jobRef, options)
  }
  await store.delete(record.previewRef)
}

const assertActivePreview = async (
  store: PreviewStore,
  record: TPreviewRecord,
  owner: Pick<TPreviewRecord, 'community' | 'userRef'> &
    Pick<TAuthenticatedOptions, 'serverTrustSecret'>,
): Promise<void> => {
  assertPreviewOwner(record, owner)
  try {
    assertPreviewFresh(record)
  } catch (error) {
    if (!(error instanceof DocsImportError) || error.code !== 'preview_expired') throw error
    await discardPreview(store, record, owner)
    throw error
  }
}

/** Creates or resumes an idempotent PreviewRecord and dispatches repository analysis. */
export const handleCreateDocImportPreview = async (
  request: Request,
  options: TAuthenticatedOptions,
): Promise<Response> => {
  try {
    const input = await body(request)
    const community = required(input.community, 'community', 128)
    const repoUrl = required(input.repoUrl, 'repoUrl', 2_048)
    const idempotencyKey =
      typeof input.idempotencyKey === 'string' && input.idempotencyKey.length <= 128
        ? input.idempotencyKey
        : randomUUID()
    if (!(await checkDocImportPassport(community, options))) {
      return json(
        { error: { code: 'forbidden', message: 'doc.import permission is required.' }, ok: false },
        403,
      )
    }

    const digest = createHmac('sha256', options.previewSecret)
      .update(`${options.userRef}\0${community}\0${repoUrl}\0${idempotencyKey}`)
      .digest('base64url')
    const previewRef = `prv_${digest.slice(0, 40)}`
    const store = getPreviewStore()
    const existing = await store.getRecord(previewRef)
    if (existing) {
      assertPreviewOwner(existing, { community, userRef: options.userRef })
      try {
        assertPreviewFresh(existing)
        const projection = await projectPreviewProcess(store, existing)
        return json({ ok: true, previewRef, ...projection }, 202)
      } catch (error) {
        if (!(error instanceof DocsImportError) || error.code !== 'preview_expired') throw error
        await discardPreview(store, existing, options)
      }
    }

    const record = createPreviewRecord({
      community,
      idempotencyKey,
      previewRef,
      repoUrl,
      userRef: options.userRef,
    })
    await store.create(record)
    const run = await start(analyzeGitHubRepo, [
      { attemptRef: record.attemptRef, community, previewRef, repoUrl },
    ])
    await store.putAnalysisRun(previewRef, {
      attemptRef: record.attemptRef,
      createdAt: new Date().toISOString(),
      previewRef,
      schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
      workflowRunRef: run.runId,
    })
    return json({ ok: true, previewRef, status: 'queued' }, 202)
  } catch (error) {
    return failure(error)
  }
}

/** Projects workflow and immutable artifact state into the public Preview response. */
export const handleGetDocImportPreview = async (
  previewRef: string,
  community: string,
  owner: Pick<TAuthenticatedOptions, 'serverTrustSecret' | 'userRef'>,
): Promise<Response> => {
  try {
    const store = getPreviewStore()
    const record = await store.getRecord(previewRef)
    if (!record) {
      throw new DocsImportError('preview_not_found', 'preview', PREVIEW_UNAVAILABLE_MESSAGE)
    }
    await assertActivePreview(store, record, {
      community,
      serverTrustSecret: owner.serverTrustSecret,
      userRef: owner.userRef,
    })
    const { error, process, status } = await projectPreviewProcess(store, record)
    const preview =
      status === 'ready' ? await store.getReview(previewRef, record.attemptRef) : undefined
    return json({
      error:
        status === 'failed'
          ? (error ?? { code: 'preview_analysis_failed', message: 'Repository analysis failed.' })
          : undefined,
      ok: status !== 'failed',
      preview,
      process,
      status,
    })
  } catch (error) {
    return failure(error)
  }
}

/** Cancels active workflows and Jobs before deleting all artifacts owned by the Preview. */
export const handleCancelDocImportPreview = async (
  previewRef: string,
  community: string,
  owner: Pick<TAuthenticatedOptions, 'serverTrustSecret' | 'userRef'>,
): Promise<Response> => {
  try {
    const store = getPreviewStore()
    const record = await store.getRecord(previewRef)
    if (!record) return json({ ok: true })
    assertPreviewOwner(record, { community, userRef: owner.userRef })
    await discardPreview(store, record, owner)
    return json({ ok: true })
  } catch (error) {
    return failure(error)
  }
}

/** Confirms a selected ready Preview, creates its Job, and dispatches the apply workflow. */
export const handleApplyDocImportPreview = async (
  request: Request,
  previewRef: string,
  options: TAuthenticatedOptions,
): Promise<Response> => {
  try {
    const input = await body(request)
    const community = required(input.community, 'community', 128)
    const selectedSourceIds = requiredStringArray(
      input.selectedSourceIds,
      'selectedSourceIds',
      5_000,
    )
    const store = getPreviewStore()
    const record = await store.getRecord(previewRef)
    if (!record) {
      throw new DocsImportError('preview_not_found', 'preview', PREVIEW_UNAVAILABLE_MESSAGE)
    }
    await assertActivePreview(store, record, {
      community,
      serverTrustSecret: options.serverTrustSecret,
      userRef: options.userRef,
    })
    const [ready, preview, analysis] = await Promise.all([
      store.getReady(previewRef, record.attemptRef),
      store.getReview(previewRef, record.attemptRef),
      store.getAnalysis(previewRef, record.attemptRef),
    ])
    if (!ready || !preview || !analysis) {
      throw new DocsImportError('preview_not_ready', 'preview', 'Preview is not ready to apply.')
    }

    const existingApplyRun = await store.getApplyRun(previewRef)
    if (existingApplyRun) {
      return json({ jobRef: existingApplyRun.jobRef, ok: true, status: 'STAGING' }, 202)
    }

    const selected = selectSourceAnalysis(analysis, selectedSourceIds)
    const job = await startDocImport(
      community,
      preview,
      selected.analysis,
      ready.datasetRef,
      options,
    )
    let run: Awaited<ReturnType<typeof start>>
    try {
      run = await start(applyDocsDataset, [
        {
          attemptRef: record.attemptRef,
          community,
          jobRef: job.id,
          previewRef,
          sourceRefs: selected.sourceRefs,
        },
      ])
    } catch (error) {
      await cancelDocImport(community, job.id, options).catch(() => undefined)
      throw error
    }
    try {
      await store.putApplyRun(previewRef, {
        attemptRef: record.attemptRef,
        createdAt: new Date().toISOString(),
        jobRef: job.id,
        previewRef,
        schemaVersion: APPLY_RUN_SCHEMA_VERSION,
        workflowRunRef: run.runId,
      })
    } catch (error) {
      await getRun(run.runId)
        .cancel()
        .catch(() => undefined)
      const persistedRun = await store.getApplyRun(previewRef)
      if (!persistedRun || persistedRun.jobRef !== job.id) {
        await cancelDocImport(community, job.id, options).catch(() => undefined)
        throw error
      }
    }
    return json({ jobRef: job.id, ok: true, status: job.status }, 202)
  } catch (error) {
    return failure(error)
  }
}
