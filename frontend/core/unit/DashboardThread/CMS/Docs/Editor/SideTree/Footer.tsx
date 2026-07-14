import { useCallback, useState, type FC } from 'react'

import useTrans from '~/hooks/useTrans'
import FileImageSVG from '~/icons/FileImage'
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
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const [trashVisible, setTrashVisible] = useState(false)
  const trashCount = trashItems.length
  const trashLabel = t('dsb.cms.docs.side_tree.footer.trash')
  const assetsLabel = t('dsb.cms.docs.side_tree.footer.assets')
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
          <button
            type='button'
            className={s.iconButton}
            aria-label={trashLabel}
            title={trashLabel}
            onClick={openTrash}
          >
            <span className={s.iconButtonSurface}>
              <TrashSVG className={s.trashIcon} />
              <span className={s.trashText}>{trashLabel}</span>
              <span className={s.count}>{trashCount}</span>
            </span>
          </button>
          <div className={s.grow} />
          <button
            type='button'
            className={s.iconButton}
            aria-label={assetsLabel}
            title={assetsLabel}
          >
            <span className={s.iconButtonSurface}>
              <FileImageSVG className={s.icon} />
              <span className={s.assetsText}>{assetsLabel}</span>
              <span className={s.count}>0</span>
            </span>
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
