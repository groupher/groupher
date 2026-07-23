import { send } from '~/lib/signal'

export const DOC_COVER_EVENT = {
  OPEN: 'dsb.doc.editor.cover.open',
} as const

export type TDocCoverEventPayload = {
  docId: string
}

export const openDocCover = (docId: string): void => {
  send(DOC_COVER_EVENT.OPEN, { docId } satisfies TDocCoverEventPayload)
}
