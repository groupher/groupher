'use client'

import { lazy, Suspense } from 'react'

import ClientOnly from '~/ui/ClientOnly'

import type { TDocCoverPinnedDoc } from '../spec'
import PinnedDocCard from './PinnedDocCard'
import useSalon from './salon'

const EditablePinnedDocsRow = lazy(() => import('./EditablePinnedDocsRow'))

type TProps = {
  docs: readonly TDocCoverPinnedDoc[]
  editable?: boolean
  onAdd?: () => void
  onEdit?: (doc: TDocCoverPinnedDoc) => void
  onUnpin?: (doc: TDocCoverPinnedDoc) => void
  onReorder?: (docs: readonly TDocCoverPinnedDoc[]) => void
}

export default function PinnedDocsRow({
  docs,
  editable = false,
  onAdd,
  onEdit,
  onUnpin,
  onReorder,
}: TProps) {
  const s = useSalon()

  if (!editable && docs.length === 0) return null

  return (
    <section className={s.wrapper} aria-label='Pinned docs'>
      {editable ? (
        <ClientOnly>
          <Suspense fallback={null}>
            <EditablePinnedDocsRow
              docs={docs}
              onAdd={onAdd}
              onEdit={onEdit}
              onUnpin={onUnpin}
              onReorder={onReorder}
            />
          </Suspense>
        </ClientOnly>
      ) : (
        <div className={s.scroller}>
          {docs.map((doc) => (
            <PinnedDocCard key={doc.nodeId} doc={doc} />
          ))}
        </div>
      )}
    </section>
  )
}
