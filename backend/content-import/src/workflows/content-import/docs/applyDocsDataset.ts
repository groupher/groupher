/**
 * Durable apply workflow for one confirmed DocsDataset selection.
 *
 *   selected sourceRefs -> convert/stage bounded batches -> atomic Phoenix apply
 *                                |
 *                                +-- failure -> fail ImportJob -> rethrow
 *
 * The workflow carries references only. Markdown remains in PreviewStore and
 * BodyBags remain in PostgreSQL staging rather than workflow state.
 *
 * @see docs/bulk-import/content-import-architecture.md
 * @see docs/bulk-import/article-publish-import-refactor.md
 * @see docs/bulk-import/import-error-handling.md
 */
import { getPreviewStore } from '../../../lib/content-import/core/preview-store'
import { runPreviewDocBulkImport } from '../../../lib/content-import/threads/docs/publisher'
import { failDocImport } from '../../../lib/content-import/transport/phoenix/docsImport'

export type TApplyDocsDatasetInput = {
  attemptRef: string
  community: string
  jobRef: string
  previewRef: string
  sourceRefs: string[]
}

const applyStep = async (input: TApplyDocsDatasetInput): Promise<void> => {
  'use step'

  const serviceSubject = 'service:content-import'
  await runPreviewDocBulkImport(
    input.community,
    input.jobRef,
    input.previewRef,
    input.attemptRef,
    input.sourceRefs,
    getPreviewStore(),
    { serviceSubject },
  )
}

const failStep = async (input: TApplyDocsDatasetInput, message: string): Promise<void> => {
  'use step'

  const serviceSubject = 'service:content-import'
  await failDocImport(input.community, input.jobRef, 'doc_import_workflow_failed', message, {
    serviceSubject,
  })
}

/** Stages the selected documents and records a terminal Job failure if the step aborts. */
export const applyDocsDataset = async (input: TApplyDocsDatasetInput): Promise<void> => {
  'use workflow'

  try {
    await applyStep(input)
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : typeof cause === 'object' &&
            cause !== null &&
            'message' in cause &&
            typeof cause.message === 'string'
          ? cause.message
          : 'Docs import workflow failed.'
    await failStep(input, message)
    throw cause
  }
}
