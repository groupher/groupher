import { CONTENT_PUBLISH_ACTION, CONTENT_SOURCE_FORMAT } from '@groupher/contracts/content-publish'
import type { TRichEditorValue } from '@groupher/rich-editor'

import { publishContentCommand } from './contentPublisher'

export type TSaveDocWorkingCopyInput = {
  value: TRichEditorValue
  community: string
  articleId: string
  workingCopyId: string
  title: string
  subtitle: string
  slug: string
  revision: number
  /** Stable identity for this save attempt; retries must reuse it. */
  commandId: string
}

export type TSaveDocQueueCopyInput = Omit<TSaveDocWorkingCopyInput, 'workingCopyId'> & {
  queueRevision: number
}

/** Saves a queued Doc copy through the trusted content publisher. */
export const saveDocQueueCopy = async <TResult>({
  value,
  community,
  articleId,
  title,
  subtitle,
  slug,
  revision,
  queueRevision,
  commandId,
}: TSaveDocQueueCopyInput): Promise<TResult> =>
  publishContentCommand<TResult>({
    action: CONTENT_PUBLISH_ACTION.SAVE_DOC_QUEUE_COPY,
    target: { community, articleId },
    payload: { content: { format: CONTENT_SOURCE_FORMAT.PLATE, value }, slug, subtitle, title },
    revision,
    queueRevision,
    commandId,
  })

/** Saves a Doc default WorkingCopy using the shared Article publisher. */
export const saveDocWorkingCopy = async <TWorkingCopy>({
  value,
  community,
  articleId,
  workingCopyId,
  title,
  subtitle,
  slug,
  revision,
  commandId,
}: TSaveDocWorkingCopyInput): Promise<TWorkingCopy> =>
  publishContentCommand<TWorkingCopy>({
    action: CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
    target: { community, articleId, workingCopyId },
    payload: { content: { format: CONTENT_SOURCE_FORMAT.PLATE, value }, slug, subtitle, title },
    revision,
    commandId,
  })
