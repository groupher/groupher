import { useCallback, useState, type FC } from 'react'

import FileImageSVG from '~/icons/FileImage'
import QuestionSVG from '~/icons/Question'
import TrashSVG from '~/icons/Trash'
import useCommunity from '~/stores/community/hooks'

import useSalon from './salon/footer'
import type { TDocTreeTrashItem } from './spec'
import TrashDrawer from './TrashDrawer'

type TProps = {
  baseRevision: number | null
  trashItems: TDocTreeTrashItem[]
  trashLoading: boolean
  onReloadTrash: () => void
  onRestored: () => void
}

const Footer: FC<TProps> = ({
  baseRevision,
  trashItems,
  trashLoading,
  onReloadTrash,
  onRestored,
}) => {
  const s = useSalon()
  const { slug: community } = useCommunity()
  const [trashVisible, setTrashVisible] = useState(false)
  const trashCount = trashItems.length
  const openTrash = useCallback(() => {
    onReloadTrash()
    setTrashVisible(true)
  }, [onReloadTrash])
  const closeTrash = useCallback(() => setTrashVisible(false), [])

  return (
    <>
      <footer className={s.wrapper}>
        <div className={s.divider} />
        <div className={s.content}>
          <button type='button' className={s.iconButton} aria-label='Trash' onClick={openTrash}>
            <span className={s.iconButtonSurface}>
              <TrashSVG className={s.trashIcon} />
              <span className={s.count}>{trashCount}</span>
            </span>
          </button>
          <button type='button' className={s.iconButton} aria-label='Assets'>
            <span className={s.iconButtonSurface}>
              <FileImageSVG className={s.icon} />
              <span className={s.count}>0</span>
            </span>
          </button>
          <div className={s.grow} />
          <button type='button' className={s.iconOnlyButton} aria-label='Help'>
            <QuestionSVG className={s.icon} />
          </button>
        </div>
      </footer>
      <TrashDrawer
        show={trashVisible}
        items={trashItems}
        loading={trashLoading}
        baseRevision={baseRevision}
        community={community}
        onClose={closeTrash}
        onReload={onReloadTrash}
        onRestored={onRestored}
      />
    </>
  )
}

export default Footer
