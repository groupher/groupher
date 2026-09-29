import type { TRichEditorValue } from '@groupher/rich-editor'
import { API_ROUTE } from '@groupher/route-contract'

type TSaveDocDraftInput = {
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

type TPublisherError = {
  message?: string
}

type TPublisherResponse<TDraft> = {
  draft?: TDraft
  error?: TPublisherError
  ok?: boolean
}

/**
 * Sends Plate value to the authenticated Node publisher and returns the draft
 * persisted by the downstream Elixir GraphQL mutation.
 *
 * @see docs/content-import/article-publish-import-refactor.md
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
  const response = await fetch(API_ROUTE.ARTIMENT_PUBLISH, {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateDocDraft',
      value,
      variables: { community, id, slug, subtitle, title, expectedVersion, commandId },
    }),
  })

  const payload = (await response.json()) as TPublisherResponse<TDraft>
  if (!response.ok || !payload.ok || !payload.draft) {
    throw new Error(payload.error?.message || 'Failed to save the document draft.')
  }

  return payload.draft
}
