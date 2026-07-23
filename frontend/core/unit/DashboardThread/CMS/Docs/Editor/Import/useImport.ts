import type { TCursorRef, TRichEditorHandle } from '@groupher/rich-editor'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import useEvent from '~/hooks/useEvent'

import { DOC_IMPORT_EVENT, type TDocImportEventPayload } from './events'

type TParams = {
  docId: string
  editorRef: RefObject<TRichEditorHandle | null>
}

export default function useImport({ docId, editorRef }: TParams) {
  const cursorRef = useRef<TCursorRef | null>(null)
  const preparedDocIdRef = useRef<string | null>(null)
  const [openDocId, setOpenDocId] = useState<string | null>(null)

  const releaseCursor = useCallback((): void => {
    cursorRef.current?.release()
    cursorRef.current = null
    preparedDocIdRef.current = null
  }, [])

  const prepare = useCallback((): void => {
    releaseCursor()
    cursorRef.current = editorRef.current?.captureCursor({ position: 'end' }) ?? null
    preparedDocIdRef.current = docId
  }, [docId, editorRef, releaseCursor])

  const close = useCallback((): void => {
    releaseCursor()
    setOpenDocId(null)
  }, [releaseCursor])

  const open = useCallback((): void => {
    if (!docId || !editorRef.current) return
    if (preparedDocIdRef.current !== docId) prepare()
    setOpenDocId(docId)
  }, [docId, editorRef, prepare])

  const handleInserted = useCallback((): void => {
    const editor = editorRef.current
    close()
    if (editor) window.requestAnimationFrame(() => editor.focus())
  }, [close, editorRef])

  useEvent<TDocImportEventPayload>(
    DOC_IMPORT_EVENT.PREPARE,
    (_msg, payload): void => {
      if (payload?.docId !== docId) return
      prepare()
    },
    [docId, prepare],
  )

  useEvent<TDocImportEventPayload>(
    DOC_IMPORT_EVENT.OPEN,
    (_msg, payload): void => {
      if (payload?.docId !== docId) return
      open()
    },
    [docId, open],
  )

  useEffect(() => {
    close()
  }, [close, docId])

  useEffect(() => releaseCursor, [releaseCursor])

  const show = openDocId === docId

  return {
    close,
    cursor: cursorRef.current,
    editor: editorRef.current,
    handleInserted,
    show,
    targetDocId: show ? docId : null,
  }
}
