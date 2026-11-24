import { type FC, useState } from 'react'

import TYPE from '~/const/type'
import { browserGraphQLRequest, GraphQLRequestError } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import CloseLightSVG from '~/icons/CloseLight'
import FileTextSVG from '~/icons/FileText'
import RotateSVG from '~/icons/Rotate'
import { executeCommand } from '~/query/mutation/optimistic/execute'
import BaseDrawer from '~/ui/Drawer'
import Pagi from '~/ui/Pagi'
import { toast } from '~/ui/Toaster'
import S from '~/unit/DsbThread/schema/docs'

import { reloadDocsPublishQueue } from '../helper'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import { SIDE_TREE_NODE_TYPE } from './constant'
import { formatMutationError } from './helper'
import useSalon from './salon/trashDrawer'
import type { TDocTreeTrashItem, TSideTreeGroup, TSideTreeTab } from './spec'

type TProps = {
  pageInfo?: import('~/spec').TGraphQLPagiPageInfo
  onPageChange?: (page: number) => void
  error?: string | null
  show: boolean
  items: TDocTreeTrashItem[]
  tabs: TSideTreeTab[]
  loading: boolean
  baseRevision: number | null
  queueRevision: number | null
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
  pageInfo,
  onPageChange,
  error,
  show,
  items,
  tabs,
  loading,
  baseRevision,
  queueRevision,
  community,
  onClose,
  onReload,
  onRestored,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [purgingId, setPurgingId] = useState<string | null>(null)
  const [purgeCandidate, setPurgeCandidate] = useState<{
    item: TDocTreeTrashItem
    revision: number
  } | null>(null)
  const [parentRequiredId, setParentRequiredId] = useState<string | null>(null)
  const [selectedParentByItem, setSelectedParentByItem] = useState<Record<string, string>>({})

  const restoreItem = async (
    item: TDocTreeTrashItem,
    targetParentNodeId?: string,
  ): Promise<void> => {
    if (
      baseRevision === null ||
      queueRevision === null ||
      restoringId !== null ||
      purgingId !== null
    )
      return

    setRestoringId(item.id)

    try {
      const data = await executeCommand({
        request: (variables) =>
          browserGraphQLRequest<{
            restoreDocsWorkspaceNode?: { treeRevision: number; queueRevision: number } | null
          }>(S.restoreDocsWorkspaceNode, variables),
        variables: {
          community,
          trashActionId: item.id,
          treeRevision: baseRevision,
          queueRevision,
          targetParentNodeId,
          targetIndex: targetParentNodeId ? (item.deletedFromIndex ?? 0) : undefined,
        },
      })
      if (!data?.restoreDocsWorkspaceNode) throw new Error('Unable to restore item')

      reloadDocsPublishQueue()
      onReload()
      onRestored()
      setParentRequiredId(null)
      toast('Restored')
    } catch (err) {
      const message = formatMutationError(err)

      if (
        message.toLowerCase().includes(RESTORE_TARGET_REQUIRED_MESSAGE) ||
        message.toLowerCase().includes('restore_parent_missing')
      ) {
        setParentRequiredId(item.id)
      } else {
        toast(message, 'error')
      }
      onReload()
    } finally {
      setRestoringId(null)
    }
  }

  const purgeItem = async (item: TDocTreeTrashItem, revision: number): Promise<void> => {
    if (queueRevision !== revision || restoringId !== null || purgingId !== null) {
      onReload()
      return
    }
    setPurgingId(item.id)
    try {
      const data = await executeCommand({
        request: (variables) =>
          browserGraphQLRequest<{ purgeDocsWorkspaceTrash?: { done?: boolean | null } | null }>(
            S.purgeDocsWorkspaceTrash,
            variables,
          ),
        variables: { community, queueRevision: revision, trashActionId: item.id },
      })
      if (!data?.purgeDocsWorkspaceTrash?.done) throw new Error('Unable to delete item')
      onReload()
    } catch (err) {
      const message = formatMutationError(err)
      const inUse =
        err instanceof GraphQLRequestError &&
        err.errors.some((error) => String(error.extensions?.code) === '4574')
      toast(inUse ? t('dsb.doc.queue.purge_in_use') : message, 'error')
      onReload()
      onRestored()
    } finally {
      setPurgingId(null)
    }
  }

  return (
    <BaseDrawer show={show} onClose={onClose} type={TYPE.DRAWER.DOC_TRASH}>
      <ConfirmDeleteModal
        message={purgeCandidate ? t('dsb.doc.queue.purge_confirm') : null}
        onCancel={() => setPurgeCandidate(null)}
        onConfirm={() => {
          const candidate = purgeCandidate
          setPurgeCandidate(null)
          if (candidate) void purgeItem(candidate.item, candidate.revision)
        }}
      />
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
          {error && (
            <div role='alert'>
              {error}{' '}
              <button type='button' onClick={onReload}>
                重试
              </button>
            </div>
          )}
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
                        disabled={
                          baseRevision === null ||
                          queueRevision === null ||
                          restoringId !== null ||
                          purgingId !== null ||
                          parentRequired
                        }
                        aria-busy={restoringId === item.id}
                        onClick={() => restoreItem(item)}
                      >
                        <RotateSVG className={s.restoreIcon} />
                        <span>{restoringId === item.id ? 'Restoring' : 'Restore'}</span>
                      </button>
                      <button
                        type='button'
                        className={s.restoreButton}
                        disabled={
                          queueRevision === null || restoringId !== null || purgingId !== null
                        }
                        aria-busy={purgingId === item.id}
                        onClick={() =>
                          queueRevision !== null &&
                          setPurgeCandidate({ item, revision: queueRevision })
                        }
                      >
                        {t('dsb.doc.queue.purge')}
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
      <Pagi pageInfo={pageInfo} onChange={onPageChange} />
    </BaseDrawer>
  )
}

export default TrashDrawer
