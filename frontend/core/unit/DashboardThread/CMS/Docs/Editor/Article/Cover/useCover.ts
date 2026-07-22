import { useEffect, useState } from 'react'

import useEvent from '~/hooks/useEvent'

import { DOC_COVER_EVENT, type TDocCoverEventPayload } from './events'

export default function useCover(docId: string): boolean {
  const [openDocId, setOpenDocId] = useState<string | null>(null)

  useEvent<TDocCoverEventPayload>(
    DOC_COVER_EVENT.OPEN,
    (_msg, payload): void => {
      if (payload?.docId !== docId) return
      setOpenDocId(docId)
    },
    [docId],
  )

  useEffect(() => {
    setOpenDocId(null)
  }, [docId])

  return openDocId === docId
}
