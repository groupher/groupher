import { useCallback, useState, type FC } from 'react'

import useQuery from '~/hooks/useQuery'
import FileImageSVG from '~/icons/FileImage'
import QuestionSVG from '~/icons/Question'
import TrashSVG from '~/icons/Trash'
import useCommunity from '~/stores/community/hooks'
import S from '~/unit/DashboardThread/schema'

import useSalon from './salon/footer'
import type { TDocTreeTrashData } from './spec'
import TrashDrawer from './TrashDrawer'

type TProps = {
  baseRevision: number | null
  onRestored: () => void
}

const Footer: FC<TProps> = ({ baseRevision, onRestored }) => {
  const s = useSalon()
  const { slug: community } = useCommunity()
  const [trashVisible, setTrashVisible] = useState(false)
  const { data, loading, reload } = useQuery<TDocTreeTrashData>(S.docTreeTrashItems, {
    community,
  })
  const trashItems = data?.docTreeTrashItems ?? []
  const trashCount = trashItems.length
  const openTrash = useCallback(() => {
    reload()
    setTrashVisible(true)
  }, [reload])
  const closeTrash = useCallback(() => setTrashVisible(false), [])

  return (
    <>
      <footer className={s.wrapper}>
        <div className={s.divider} />
        <div className={s.content}>
          <button type='button' className={s.iconButton} aria-label='Trash' onClick={openTrash}>
            <TrashSVG className={s.icon} />
            <span className={s.count}>{trashCount}</span>
          </button>
          <div className={s.grow} />
          <button type='button' className={s.iconButton} aria-label='Assets'>
            <FileImageSVG className={s.icon} />
            <span className={s.count}>0</span>
          </button>
          <button type='button' className={s.iconOnlyButton} aria-label='Help'>
            <QuestionSVG className={s.icon} />
          </button>
        </div>
      </footer>
      <TrashDrawer
        show={trashVisible}
        items={trashItems}
        loading={loading}
        baseRevision={baseRevision}
        community={community}
        onClose={closeTrash}
        onReload={reload}
        onRestored={onRestored}
      />
    </>
  )
}

export default Footer
