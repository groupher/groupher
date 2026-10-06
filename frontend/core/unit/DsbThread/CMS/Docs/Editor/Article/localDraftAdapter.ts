/**
 * Adapts the Doc editor's canonical state to the host-neutral local-history payload.
 *
 *   Doc editor state -> Doc adapter -> LocalDraftHistory
 */

import type { TLocalDraftPayload } from '~/lib/localDraftHistory'

import type { TDraftEditorState } from './hooks/useDraftEditorState'

/** Captures every currently delivered Doc content field needed for local recovery. */
export const toDocLocalDraftPayload = (state: TDraftEditorState): TLocalDraftPayload => ({
  title: state.draft.title,
  slug: state.draft.slug,
  body: state.draft.bodyValue,
  fields: { subtitle: state.draft.subtitle },
  tagIds: [],
  cover: null,
})
