import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type FC, type KeyboardEvent, useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import SavingBar from '~/unit/DashboardThread/SavingBar'
import IconHub from '~/widgets/IconHub'

import type { TSideTreeTab } from '../../SideTree/spec'
import useSalon, { cn } from './salon'

type TProps = {
  canDelete: boolean
  dragLocked: boolean
  editing: boolean
  interactionLocked: boolean
  tab: TSideTreeTab
  onDelete: (tab: TSideTreeTab) => void
  onStartRename: () => void
  onCancelRename: () => void
  onRename: (tabId: string, title: string) => void
}

const SortableTabRow: FC<TProps> = ({
  canDelete,
  dragLocked,
  editing,
  interactionLocked,
  tab,
  onDelete,
  onStartRename,
  onCancelRename,
  onRename,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const [draftTitle, setDraftTitle] = useState(tab.title)
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id, disabled: editing || dragLocked })

  useEffect(() => {
    if (editing) setDraftTitle(tab.title)
  }, [editing, tab.title])

  const style = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: 0,
        })
      : undefined,
    transition,
  }

  const startEditing = (): void => {
    setDraftTitle(tab.title)
    onStartRename()
  }

  const cancelEditing = (): void => {
    setDraftTitle(tab.title)
    onCancelRename()
  }

  const commitTitle = (): void => {
    const title = draftTitle.trim()
    if (title && title !== tab.title) onRename(tab.id, title)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitTitle()
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEditing()
    }
  }

  return (
    <div ref={setNodeRef} style={style} className={cn(s.row, isDragging && s.rowDragging)}>
      {!editing && (
        <button
          ref={setActivatorNodeRef}
          type='button'
          className={s.dragHandle}
          aria-label={`${t('dsb.doc.tabs.drag')}: ${tab.title}`}
          {...attributes}
          {...listeners}
        >
          <IconHub provider='phosphor' icon='dots-six-vertical' size={4} className={s.dragIcon} />
        </button>
      )}

      <div
        className={cn(s.rowContent, isDragging && s.rowContentDragging, editing && s.editingRow)}
      >
        {editing ? (
          <SavingBar
            isTouched
            density='compact'
            view='inline'
            disabled={!draftTitle.trim() || draftTitle.trim() === tab.title}
            onCancel={cancelEditing}
            onConfirm={commitTitle}
          >
            <input
              autoFocus
              className={s.editInput}
              aria-label={`${t('dsb.doc.tabs.rename')}: ${tab.title}`}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={handleKeyDown}
            />
          </SavingBar>
        ) : (
          <div className={s.titleText}>{tab.title}</div>
        )}

        {!editing && (
          <div className={s.actions}>
            <button
              type='button'
              className={s.actionButton}
              aria-label={`${t('dsb.doc.tabs.rename')}: ${tab.title}`}
              disabled={interactionLocked}
              onClick={startEditing}
            >
              <IconHub
                provider='phosphor'
                icon='pencil'
                size={4}
                className={cn(s.actionIcon, s.editIcon)}
              />
            </button>
            <button
              type='button'
              className={cn(s.actionButton, s.deleteButton)}
              aria-label={`${t('dsb.doc.tabs.delete')}: ${tab.title}`}
              disabled={!canDelete || interactionLocked}
              onClick={() => onDelete(tab)}
            >
              <IconHub
                provider='phosphor'
                icon='trash'
                size={4}
                className={cn(s.actionIcon, s.deleteIcon)}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SortableTabRow
