import { send } from '~/lib/signal'

export const DOC_IMPORT_EVENT = {
  OPEN: 'dsb.doc.editor.import.open',
  PREPARE: 'dsb.doc.editor.import.prepare',
} as const

export type TDocImportEventPayload = {
  docId: string
}

export const prepareDocImport = (docId: string): void => {
  send(DOC_IMPORT_EVENT.PREPARE, { docId } satisfies TDocImportEventPayload)
}

export const openDocImport = (docId: string): void => {
  send(DOC_IMPORT_EVENT.OPEN, { docId } satisfies TDocImportEventPayload)
}
