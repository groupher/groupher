import { CONTENT_PUBLISH_ACTION, CONTENT_SOURCE_FORMAT } from '@groupher/contracts/content-publish'
import type { TRichEditorValue } from '@groupher/rich-editor'

import { publishContentCommand } from './contentPublisher'

export type TSaveDocDraftInput = {
  value: TRichEditorValue
  community: string
  id: string
  title: string
  subtitle: string
  slug: string
  expectedVersion: number
  /** Stable identity for this save attempt; retries must reuse it. */
  commandId: string
}

/**
 * Sends Plate value to the authenticated Node publisher and returns the draft
 * persisted by the downstream Elixir GraphQL mutation.
 *
 * @see docs/import/article-publish-import-refactor.md
 */
export const saveDocDraft = async <TDraft>({
  value,
  community,
  id,
  title,
  subtitle,
  slug,
  expectedVersion,
  commandId,
}: TSaveDocDraftInput): Promise<TDraft> => {
  return publishContentCommand<TDraft>({
    action: CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT,
    target: { community, documentId: id },
    payload: { content: { format: CONTENT_SOURCE_FORMAT.PLATE, value }, slug, subtitle, title },
    expectedVersion,
    commandId,
  })
}
