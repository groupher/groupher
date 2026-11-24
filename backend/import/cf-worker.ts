/**
 * Cloudflare Worker entrypoint for Content Import.
 *
 * HTTP request -> import routes -> Phoenix and Cloudflare bindings
 */
import type { R2Bucket, Workflow } from '@cloudflare/workers-types'
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'

import { createApp } from './src/app'
import type { TContentImportRuntime } from './src/lib/content-import/http'
import { ImportWorkflow } from './workers/importWorkflow'

type WorkflowPayload = {
  attemptRef: string
  community: string
  jobRef?: string
  previewRef: string
  repoUrl?: string
  sourceRefs?: string[]
}

type Env = {
  ARTIFACTS: R2Bucket
  ANALYSIS_WORKFLOW: Workflow<WorkflowPayload>
  APPLY_WORKFLOW: Workflow<WorkflowPayload>
  CONTENT_IMPORT_PREVIEW_SECRET: string
  ENVIRONMENT: string
  PHOENIX_GRAPHQL_ENDPOINT: string
  SERVICE_AUTH_ISSUER: string
  SERVICE_AUTH_JWKS_URL: string
  DOCUMENT_CONVERTER_APP_ENDPOINT: string
  CONTENT_IMPORT_SERVICE_AUTH_AUDIENCE: string
}

const disableUnsupportedConsoleTask = (): void => {
  try {
    Object.defineProperty(console, 'createTask', { configurable: true, value: undefined })
  } catch {
    // React's development runtime only uses this optional inspector hook.
  }
}

export class ApplyWorkflow extends WorkflowEntrypoint<Env, WorkflowPayload> {
  async run(event: WorkflowEvent<WorkflowPayload>, step: WorkflowStep): Promise<void> {
    const payload = event.payload
    if (!payload.jobRef || !payload.sourceRefs) throw new Error('apply_workflow_payload_invalid')
    disableUnsupportedConsoleTask()
    const [
      { createR2PreviewStore },
      { runPreviewDocBulkImport },
      { applyDocImport, failDocImport },
    ] = await Promise.all([
      import('./src/lib/content-import/core/preview-store/cloudflare'),
      import('./src/lib/content-import/threads/docs/publisher'),
      import('./src/lib/content-import/transport/phoenix/docsImport'),
    ])
    try {
      const store = createR2PreviewStore(this.env.ARTIFACTS)
      for (const [index, sourceRef] of payload.sourceRefs!.entries()) {
        await step.do(`stage selected Doc ${index + 1}`, async () => {
          const result = await runPreviewDocBulkImport(
            payload.community,
            payload.jobRef!,
            payload.previewRef,
            payload.attemptRef,
            [sourceRef],
            store,
            { apply: false, serviceSubject: 'service:content-import' },
          )
          if (result.status.toLowerCase() === 'failed') {
            throw new Error(`Document staging failed at item ${index + 1}.`)
          }
        })
      }
      await step.do('apply staged Docs', async () =>
        applyDocImport(payload.community, payload.jobRef!, {
          serviceSubject: 'service:content-import',
        }),
      )
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Docs import workflow failed.'
      await step.do('mark Phoenix import job failed', async () => {
        await failDocImport(
          payload.community,
          payload.jobRef!,
          'doc_import_workflow_failed',
          message,
          { serviceSubject: 'service:content-import' },
        )
      })
      throw cause
    }
  }
}

const workflowRuntime = async (env: Env): Promise<TContentImportRuntime> => {
  const { createR2PreviewStore } =
    await import('./src/lib/content-import/core/preview-store/cloudflare')
  const workflowStatus = async (binding: Workflow<WorkflowPayload>, id: string) => {
    const status = await (await binding.get(id)).status()
    if (status.status === 'errored') {
      return {
        status: 'errored' as const,
        error: { message: status.error?.message || 'Workflow failed.' },
      }
    }
    if (status.status === 'terminated') return { status: 'cancelled' as const }
    if (status.status === 'complete') return { status: 'complete' as const }
    if (status.status === 'queued') return { status: 'queued' as const }
    if (status.status === 'waiting' || status.status === 'paused')
      return { status: 'waiting' as const }
    return { status: 'running' as const }
  }

  return {
    store: createR2PreviewStore(env.ARTIFACTS),
    workflows: {
      async startAnalysis(input) {
        const id = `analyze-${crypto.randomUUID()}`
        const instance = await env.ANALYSIS_WORKFLOW.create({ id, params: input })
        return instance.id
      },
      async startApply(input) {
        const id = `apply-${crypto.randomUUID()}`
        const instance = await env.APPLY_WORKFLOW.create({ id, params: input })
        return instance.id
      },
      status(id) {
        return workflowStatus(
          id.startsWith('apply-') ? env.APPLY_WORKFLOW : env.ANALYSIS_WORKFLOW,
          id,
        )
      },
      async cancel(id) {
        const workflow = id.startsWith('apply-') ? env.APPLY_WORKFLOW : env.ANALYSIS_WORKFLOW
        await (await workflow.get(id)).terminate()
      },
    },
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    disableUnsupportedConsoleTask()
    const [handlers, runtime, documentImporter, workerPlatform] = await Promise.all([
      import('./src/lib/content-import/http'),
      workflowRuntime(env),
      import('./src/lib/document-importer/http'),
      import('./src/lib/document-importer/workerPlatform'),
    ])
    const app = createApp({
      environment: {
        ...process.env,
        CONTENT_IMPORT_SERVICE_AUTH_AUDIENCE: env.CONTENT_IMPORT_SERVICE_AUTH_AUDIENCE,
        ENVIRONMENT: env.ENVIRONMENT,
      },
      handlers: {
        importDocument: (request) =>
          documentImporter.handleDocumentImportRequest(request, {
            converterEndpoint: env.DOCUMENT_CONVERTER_APP_ENDPOINT,
            importDocumentationUrl: workerPlatform.importDocumentationUrlOnWorker,
          }),
        applyPreview: (request, previewRef, options) =>
          handlers.handleApplyDocImportPreview(request, previewRef, options, runtime),
        cancelPreview: (previewRef, community, owner) =>
          handlers.handleCancelDocImportPreview(previewRef, community, owner, runtime),
        createPreview: (request, options) =>
          handlers.handleCreateDocImportPreview(request, options, runtime),
        getPreview: (previewRef, community, owner) =>
          handlers.handleGetDocImportPreview(previewRef, community, owner, runtime),
      },
    })
    return app.fetch(request)
  },
}

export { ImportWorkflow }
