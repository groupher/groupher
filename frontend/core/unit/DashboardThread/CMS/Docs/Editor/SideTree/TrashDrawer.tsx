import type { FC } from 'react'

import TYPE from '~/const/type'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import CloseLightSVG from '~/icons/CloseLight'
import FileTextSVG from '~/icons/FileText'
import RotateSVG from '~/icons/Rotate'
import S from '~/unit/DashboardThread/schema'
import BaseDrawer from '~/widgets/Drawer'
import { toast } from '~/widgets/Toaster'

import { reloadDocPublishChecklist } from '../helper'
import { formatMutationError } from './helper'
import useSalon from './salon/trashDrawer'
import type { TDocTreeMutationData, TDocTreeMutationPayload, TDocTreeTrashItem } from './spec'

type TProps = {
  show: boolean
  items: TDocTreeTrashItem[]
  loading: boolean
  baseRevision: number | null
  community: string
  onClose: () => void
  onReload: () => void
  onRestored: () => void
}

const DELETED_AT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const formatDeletedAt = (value?: string | null): string => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return DELETED_AT_FORMATTER.format(date)
}

const itemTypeLabel = (type?: string | null): string => {
  if (!type) return 'item'

  return type.toLowerCase()
}

const TrashDrawer: FC<TProps> = ({
  show,
  items,
  loading,
  baseRevision,
  community,
  onClose,
  onReload,
  onRestored,
}) => {
  const s = useSalon()
  const { mutate } = useGraphQLClient()

  const restoreItem = async (item: TDocTreeTrashItem): Promise<void> => {
    if (baseRevision === null) return

    try {
      const data = await mutate<TDocTreeMutationData>(S.restoreDocTreeTrashItem, {
        community,
        id: item.id,
        baseRevision,
      })
      const payload = data?.restoreDocTreeTrashItem as TDocTreeMutationPayload | null | undefined

      if (payload?.conflict) {
        onRestored()
        toast('Tree changed. Reloaded latest docs tree.', 'error')
        return
      }

      reloadDocPublishChecklist()
      onReload()
      onRestored()
      toast('Restored')
    } catch (err) {
      toast(formatMutationError(err), 'error')
      onReload()
    }
  }

  return (
    <BaseDrawer show={show} onClose={onClose} type={TYPE.DRAWER.DOC_TRASH}>
      <div className={s.drawer}>
        <div className={s.header}>
          <div className={s.titleGroup}>
            <FileTextSVG className={s.titleIcon} />
            <div className={s.title}>Trash</div>
          </div>
          <button
            type='button'
            className={s.closeButton}
            aria-label='Close trash'
            onClick={onClose}
          >
            <CloseLightSVG className={s.closeIcon} />
          </button>
        </div>

        <div className={s.body}>
          {loading ? (
            <div className={s.empty}>Loading</div>
          ) : items.length === 0 ? (
            <div className={s.empty}>No deleted items</div>
          ) : (
            <div className={s.list}>
              {items.map((item) => (
                <div key={item.id} className={s.item}>
                  <div className={s.itemIconWrap}>
                    <FileTextSVG className={s.itemIcon} />
                  </div>
                  <div className={s.itemMain}>
                    <div className={s.itemTitle}>{item.title || item.nodeId}</div>
                    <div className={s.itemMeta}>
                      {itemTypeLabel(item.type)}
                      {formatDeletedAt(item.deletedAt)
                        ? ` - ${formatDeletedAt(item.deletedAt)}`
                        : ''}
                    </div>
                  </div>
                  <button
                    type='button'
                    className={s.restoreButton}
                    disabled={baseRevision === null}
                    onClick={() => restoreItem(item)}
                  >
                    <RotateSVG className={s.restoreIcon} />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseDrawer>
  )
}

export default TrashDrawer
