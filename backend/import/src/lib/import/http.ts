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
 * @see docs/import/import-architecture.md
 * @see docs/import/bulk-import.md
 * @see docs/import/import-error-handling.md
 */
import { createHmac, randomUUID } from 'node:crypto'

import { GroupherGraphQLError } from '../groupherGraphql'
import { DocsImportError } from './core/errors'
import {
  ANALYSIS_RUN_SCHEMA_VERSION,
  APPLY_RUN_SCHEMA_VERSION,
  assertPreviewFresh,
  assertPreviewOwner,
  createPreviewRecord,
  PREVIEW_UNAVAILABLE_MESSAGE,
  type PreviewStore,
  type TPreviewRecord,
} from './core/preview-store/previewStore'
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
  serviceSubject: string
  userRef: string
}

/** Cloudflare Workflow boundary injected by the Worker entrypoint. */
export type TImportWorkflowRuntime = {
  startAnalysis: (input: {
    attemptRef: string
    community: string
    previewRef: string
    repoUrl: string
  }) => Promise<string>
  startApply: (
    workflowRunRef: string,
    input: {
      attemptRef: string
      community: string
      jobRef: string
      previewRef: string
      sourceRefs: string[]
    },
  ) => Promise<void>
  status: (workflowRunRef: string) => Promise<{
    status: 'cancelled' | 'complete' | 'errored' | 'pending' | 'queued' | 'running' | 'waiting'
    error?: { message: string }
  }>
  cancel: (workflowRunRef: string) => Promise<void>
}

export type TImportRuntime = {
  store: PreviewStore
  workflows: TImportWorkflowRuntime
}

const resolveRuntime = async (
  runtime: TImportRuntime | undefined,
): Promise<TImportRuntime> => {
  if (!runtime) throw new Error('Cloudflare import runtime is not configured.')
  return runtime
}

const json = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })

const previewErrorStatus: Record<string, number> = {
  preview_not_found: 404,
  preview_expired: 410,
  preview_attempt_conflict: 409,
}

const failure = (error: unknown): Response => {
  if (
    error instanceof GroupherGraphQLError &&
    (error.code === 'target_revision_conflict' || error.code === 'import_intent_conflict')
  ) {
    return json({ error: { code: error.code, message: error.message }, ok: false }, 409)
  }
  if (error instanceof DocsImportError) {
    return json(
      {
        error: { code: error.code, message: error.message, retryable: error.retryable },
        ok: false,
      },
      previewErrorStatus[error.code] ?? 400,
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

const sourceIdList = (value: unknown, name: string, minItems: number): string[] => {
  if (!Array.isArray(value) || value.length < minItems || value.length > 5_000) {
    throw new DocsImportError('invalid_request', 'admission', `${name} is required.`)
  }
  return Array.from(new Set(value.map((item) => required(item, name, 1_024))))
}

const discardPreview = async (
  store: PreviewStore,
  record: TPreviewRecord,
  options: Pick<TAuthenticatedOptions, 'serviceSubject'>,
  workflows: TImportWorkflowRuntime,
): Promise<void> => {
  const [analysisRun, applyRun] = await Promise.all([
    store.getAnalysisRun(record.previewRef),
    store.getApplyRun(record.previewRef),
  ])
  await Promise.all(
    [analysisRun, applyRun]
      .filter((run) => run !== null)
      .map((run) => workflows.cancel(run.workflowRunRef).catch(() => undefined)),
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
    Pick<TAuthenticatedOptions, 'serviceSubject'>,
  workflows: TImportWorkflowRuntime,
): Promise<void> => {
  assertPreviewOwner(record, owner)
  try {
    assertPreviewFresh(record)
  } catch (error) {
    if (!(error instanceof DocsImportError) || error.code !== 'preview_expired') throw error
    await discardPreview(store, record, owner, workflows)
    throw error
  }
}

const dispatchPreviewAnalysis = async (
  store: PreviewStore,
  record: TPreviewRecord,
  workflows: TImportWorkflowRuntime,
): Promise<void> => {
  let workflowRunRef: string | null = null

  try {
    workflowRunRef = await workflows.startAnalysis({
      attemptRef: record.attemptRef,
      community: record.community,
      previewRef: record.previewRef,
      repoUrl: record.requestedSource.repoUrl,
    })
    await store.putAnalysisRun(record.previewRef, {
      attemptRef: record.attemptRef,
      createdAt: new Date().toISOString(),
      previewRef: record.previewRef,
      schemaVersion: ANALYSIS_RUN_SCHEMA_VERSION,
      workflowRunRef,
    })
  } catch (error) {
    if (workflowRunRef) {
      await workflows.cancel(workflowRunRef).catch(() => undefined)
    }
    await store.delete(record.previewRef)
    throw error
  }
}

/** Creates or resumes an idempotent PreviewRecord and dispatches repository analysis. */
export const handleCreateDocImportPreview = async (
  request: Request,
  options: TAuthenticatedOptions,
  runtimeOverride?: TImportRuntime,
): Promise<Response> => {
  try {
    const runtime = await resolveRuntime(runtimeOverride)
    const input = await body(request)
    const community = required(input.community, 'community', 128)
    const repoUrl = required(input.repoUrl, 'repoUrl', 2_048)
    const commandId =
      typeof input.commandId === 'string' && input.commandId.length <= 128
        ? input.commandId
        : randomUUID()
    if (!(await checkDocImportPassport(community, options))) {
      return json(
        { error: { code: 'forbidden', message: 'doc.import permission is required.' }, ok: false },
        403,
      )
    }

    const digest = createHmac('sha256', options.previewSecret)
      .update(`${options.userRef}\0${community}\0${repoUrl}\0${commandId}`)
      .digest('base64url')
    const previewRef = `prv_${digest.slice(0, 40)}`
    const store = runtime.store
    const existing = await store.getRecord(previewRef)
    if (existing) {
      assertPreviewOwner(existing, { community, userRef: options.userRef })
      try {
        assertPreviewFresh(existing)
        const projection = await projectPreviewProcess(store, existing, runtime.workflows)
        return json({ ok: true, previewRef, ...projection }, 202)
      } catch (error) {
        if (!(error instanceof DocsImportError) || error.code !== 'preview_expired') throw error
        await discardPreview(store, existing, options, runtime.workflows)
      }
    }

    const record = createPreviewRecord({
      community,
      commandId,
      previewRef,
      repoUrl,
      userRef: options.userRef,
    })
    await store.create(record)
    await dispatchPreviewAnalysis(store, record, runtime.workflows)
    return json({ ok: true, previewRef, status: 'queued' }, 202)
  } catch (error) {
    return failure(error)
  }
}

/** Projects workflow and immutable artifact state into the public Preview response. */
export const handleGetDocImportPreview = async (
  previewRef: string,
  community: string,
  owner: Pick<TAuthenticatedOptions, 'serviceSubject' | 'userRef'>,
  runtimeOverride?: TImportRuntime,
): Promise<Response> => {
  try {
    const runtime = await resolveRuntime(runtimeOverride)
    const store = runtime.store
    const record = await store.getRecord(previewRef)
    if (!record) {
      throw new DocsImportError('preview_not_found', 'preview', PREVIEW_UNAVAILABLE_MESSAGE)
    }
    await assertActivePreview(
      store,
      record,
      {
        community,
        serviceSubject: owner.serviceSubject,
        userRef: owner.userRef,
      },
      runtime.workflows,
    )
    const { error, process, status } = await projectPreviewProcess(store, record, runtime.workflows)
    const preview =
      status === 'ready' ? await store.getReview(previewRef, record.attemptRef) : undefined
    return json({
      error:
        status === 'failed'
          ? (error ?? { code: 'preview_analysis_failed', message: 'Repository analysis failed.' })
          : undefined,
      ok: status !== 'failed',
      preview: preview ? { ...preview, attemptRef: record.attemptRef } : preview,
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
  owner: Pick<TAuthenticatedOptions, 'serviceSubject' | 'userRef'>,
  runtimeOverride?: TImportRuntime,
): Promise<Response> => {
  try {
    const runtime = await resolveRuntime(runtimeOverride)
    const store = runtime.store
    const record = await store.getRecord(previewRef)
    if (!record) return json({ ok: true })
    assertPreviewOwner(record, { community, userRef: owner.userRef })
    await discardPreview(store, record, owner, runtime.workflows)
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
  runtimeOverride?: TImportRuntime,
): Promise<Response> => {
  try {
    const runtime = await resolveRuntime(runtimeOverride)
    const input = await body(request)
    const community = required(input.community, 'community', 128)
    const selectedSourceIds = sourceIdList(input.selectedSourceIds, 'selectedSourceIds', 1)
    const overwriteIds = sourceIdList(
      input.overwriteSourceIds === undefined ? [] : input.overwriteSourceIds,
      'overwriteSourceIds',
      0,
    )
    const selectedIds = new Set(selectedSourceIds)
    if (overwriteIds.some((id) => !selectedIds.has(id))) {
      throw new DocsImportError(
        'invalid_selection',
        'preview',
        'Confirm overwrites only for selected documents.',
      )
    }
    const store = runtime.store
    const record = await store.getRecord(previewRef)
    if (!record) {
      throw new DocsImportError('preview_not_found', 'preview', PREVIEW_UNAVAILABLE_MESSAGE)
    }
    await assertActivePreview(
      store,
      record,
      {
        community,
        serviceSubject: options.serviceSubject,
        userRef: options.userRef,
      },
      runtime.workflows,
    )
    if (
      (input.attemptRef !== undefined || overwriteIds.length > 0) &&
      input.attemptRef !== record.attemptRef
    ) {
      throw new DocsImportError(
        'preview_attempt_conflict',
        'preview',
        'Open the current preview and review your selection before importing.',
      )
    }
    const [ready, preview, analysis] = await Promise.all([
      store.getReady(previewRef, record.attemptRef),
      store.getReview(previewRef, record.attemptRef),
      store.getAnalysis(previewRef, record.attemptRef),
    ])
    if (!ready || !preview || !analysis) {
      throw new DocsImportError('preview_not_ready', 'preview', 'Preview is not ready to apply.')
    }

    const selected = selectSourceAnalysis(analysis, selectedSourceIds)
    const job = await startDocImport(
      community,
      preview,
      selected.analysis,
      ready.datasetRef,
      options,
      new Set(overwriteIds),
    )
    // Only Phoenix decides whether the submitted intent can resume its Job.
    if (['STAGING', 'READY'].includes(job.status.toUpperCase())) {
      const existingRun = await store.getApplyRun(previewRef)
      if (
        existingRun &&
        (existingRun.jobRef !== job.id || existingRun.attemptRef !== record.attemptRef)
      ) {
        throw new Error('Apply workflow association does not match the confirmed Job.')
      }
      const workflowRunRef = existingRun?.workflowRunRef ?? `apply-${job.id}`
      if (!existingRun) {
        // Store a deterministic association before dispatch so a failed attempt
        // can be cancelled or retried with the same Workflow ID.
        await store.putApplyRun(previewRef, {
          attemptRef: record.attemptRef,
          createdAt: record.createdAt,
          jobRef: job.id,
          previewRef,
          schemaVersion: APPLY_RUN_SCHEMA_VERSION,
          workflowRunRef,
        })
      }
      await runtime.workflows.startApply(workflowRunRef, {
        attemptRef: record.attemptRef,
        community,
        jobRef: job.id,
        previewRef,
        sourceRefs: selected.sourceRefs,
      })
    }
    return json({ jobRef: job.id, ok: true, status: job.status }, 202)
  } catch (error) {
    return failure(error)
  }
}
