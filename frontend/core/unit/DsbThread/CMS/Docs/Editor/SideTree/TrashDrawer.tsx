import { type FC, useState } from 'react'

import TYPE from '~/const/type'
import { browserQuery } from '~/graphql/client'
import CloseLightSVG from '~/icons/CloseLight'
import FileTextSVG from '~/icons/FileText'
import RotateSVG from '~/icons/Rotate'
import BaseDrawer from '~/ui/Drawer'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import { reloadDocPublishChecklist } from '../helper'
import { SIDE_TREE_NODE_TYPE } from './constant'
import { formatMutationError } from './helper'
import useSalon from './salon/trashDrawer'
import type {
  TDocTreeMutationData,
  TDocTreeMutationPayload,
  TDocTreeTrashItem,
  TSideTreeGroup,
  TSideTreeTab,
} from './spec'

type TProps = {
  show: boolean
  items: TDocTreeTrashItem[]
  tabs: TSideTreeTab[]
  loading: boolean
  baseRevision: number | null
  community: string
  onClose: () => void
  onReload: () => void
  onRestored: () => void
}

export type TRestoreParentOption = {
  id: string
  title: string
  type: 'tab' | typeof SIDE_TREE_NODE_TYPE.GROUP
  depth: number
}

const appendGroupOptions = (
  options: TRestoreParentOption[],
  groups: readonly TSideTreeGroup[],
  depth: number,
): void => {
  for (const group of groups) {
    options.push({
      id: group.id,
      title: group.title,
      type: SIDE_TREE_NODE_TYPE.GROUP,
      depth,
    })
    appendGroupOptions(
      options,
      group.pages.filter(
        (child): child is TSideTreeGroup => child.type === SIDE_TREE_NODE_TYPE.GROUP,
      ),
      depth + 1,
    )
  }
}

/** Builds restore parent options from typed frontend shared inputs. */
export const buildRestoreParentOptions = (
  tabs: readonly TSideTreeTab[],
  itemType?: string | null,
): TRestoreParentOption[] => {
  const options: TRestoreParentOption[] = []
  const normalizedType = itemType?.toLowerCase()
  const tabOnly = normalizedType === SIDE_TREE_NODE_TYPE.PIN
  const groupOnly =
    normalizedType === SIDE_TREE_NODE_TYPE.PAGE || normalizedType === SIDE_TREE_NODE_TYPE.LINK

  for (const tab of tabs) {
    if (!groupOnly) options.push({ id: tab.id, title: tab.title, type: 'tab', depth: 0 })
    if (!tabOnly) appendGroupOptions(options, tab.groups, 1)
  }

  return options
}

const RESTORE_TARGET_REQUIRED_MESSAGE = 'select a new parent'

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
  tabs,
  loading,
  baseRevision,
  community,
  onClose,
  onReload,
  onRestored,
}) => {
  const s = useSalon()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [parentRequiredId, setParentRequiredId] = useState<string | null>(null)
  const [selectedParentByItem, setSelectedParentByItem] = useState<Record<string, string>>({})

  const restoreItem = async (
    item: TDocTreeTrashItem,
    targetParentNodeId?: string,
  ): Promise<void> => {
    if (baseRevision === null || restoringId !== null) return

    setRestoringId(item.id)

    try {
      const data = await browserQuery<TDocTreeMutationData>(S.restoreDocTreeTrashItem, {
        community,
        id: item.id,
        baseRevision,
        targetParentNodeId,
        targetIndex: targetParentNodeId ? (item.deletedFromIndex ?? 0) : undefined,
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
      setParentRequiredId(null)
      toast('Restored')
    } catch (err) {
      const message = formatMutationError(err)

      if (message.toLowerCase().includes(RESTORE_TARGET_REQUIRED_MESSAGE)) {
        setParentRequiredId(item.id)
      } else {
        toast(message, 'error')
      }
      onReload()
    } finally {
      setRestoringId(null)
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
              {items.map((item) => {
                const parentRequired = parentRequiredId === item.id
                const selectedParent = selectedParentByItem[item.id] ?? ''
                const parentOptions = parentRequired
                  ? buildRestoreParentOptions(tabs, item.type).filter(
                      (option) => option.id !== item.nodeId,
                    )
                  : []

                return (
                  <div key={item.id} className={s.item}>
                    <div className={s.itemRow}>
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
                        disabled={baseRevision === null || restoringId !== null || parentRequired}
                        aria-busy={restoringId === item.id}
                        onClick={() => restoreItem(item)}
                      >
                        <RotateSVG className={s.restoreIcon} />
                        <span>{restoringId === item.id ? 'Restoring' : 'Restore'}</span>
                      </button>
                    </div>
                    {parentRequired && (
                      <div className={s.restoreTarget}>
                        <label
                          className={s.restoreTargetLabel}
                          htmlFor={`restore-parent-${item.id}`}
                        >
                          The original parent was deleted. Choose a new parent.
                        </label>
                        {parentOptions.length === 0 ? (
                          <div className={s.restoreTargetEmpty}>No valid parent is available.</div>
                        ) : (
                          <div className={s.restoreTargetControls}>
                            <select
                              id={`restore-parent-${item.id}`}
                              className={s.restoreTargetSelect}
                              value={selectedParent}
                              onChange={(event) =>
                                setSelectedParentByItem((current) => ({
                                  ...current,
                                  [item.id]: event.target.value,
                                }))
                              }
                            >
                              <option value=''>Select a parent</option>
                              {parentOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {`${'  '.repeat(option.depth)}${option.title} (${option.type})`}
                                </option>
                              ))}
                            </select>
                            <button
                              type='button'
                              className={s.restoreTargetButton}
                              disabled={!selectedParent || restoringId !== null}
                              onClick={() => restoreItem(item, selectedParent)}
                            >
                              Restore here
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </BaseDrawer>
  )
}

export default TrashDrawer
