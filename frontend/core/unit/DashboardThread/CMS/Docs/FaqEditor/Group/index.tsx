import { useState } from 'react'

import EditSVG from '~/icons/EditPen'
import GrabDotsSVG from '~/icons/GrabDots'
import useDocFaqActions from '~/stores/dashboard/docFaq/actions'

import { FAQ_EDITOR_COPY, FAQ_GROUP_MENU_ACTION, FAQ_SAVE_ZONE } from '../constant'
import SortableFaqColumn from '../Dnd/SortableFaqColumn'
import SortableFaqGroup from '../Dnd/SortableFaqGroup'
import SortableFaqItem from '../Dnd/SortableFaqItem'
import InlineTextEditor from '../InlineTextEditor'
import useSalon, { cn } from '../salon/group'
import type { TFaqDragTarget, TFaqEditorGroup, TFaqSaveZone } from '../spec'
import ActionMenu, { GROUP_MENU_ITEMS } from './ActionMenu'
import Item from './Item'

type TProps = {
  saveZone: TFaqSaveZone
  editLocked: boolean
  isDocFaqTouched: boolean
  group: TFaqEditorGroup
  grouped: boolean
  openedItemId: string | null
  showTargetLine: boolean
  targetDragItemId: string | null
  targetDragPosition: TFaqDragTarget['position'] | null
  onToggleItem: (itemId: string) => void
  onOpenItem: (itemId: string) => void
}

export default function Group({
  saveZone,
  editLocked,
  isDocFaqTouched,
  group,
  grouped,
  openedItemId,
  showTargetLine,
  targetDragItemId,
  targetDragPosition,
  onToggleItem,
  onOpenItem,
}: TProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const s = useSalon()
  const { addItem, clearSaveZone, deleteGroup, renameGroup, setSaveZone } = useDocFaqActions()
  const titleActive = saveZone?.type === FAQ_SAVE_ZONE.GROUP_TITLE && saveZone.groupId === group.id

  return (
    <SortableFaqColumn
      className={cn(s.wrapper, showTargetLine && s.wrapperTarget)}
      columnId={group.id}
      disabled={!grouped || editLocked}
    >
      {({ attributes, listeners, setActivatorNodeRef }) => (
        <>
          {grouped && (
            <div className={s.head}>
              {!editLocked && (
                <button
                  ref={setActivatorNodeRef}
                  type='button'
                  className={s.dragHandle}
                  aria-label={FAQ_EDITOR_COPY.DRAG_GROUP_ARIA_LABEL}
                  {...attributes}
                  {...listeners}
                >
                  <GrabDotsSVG className='size-3.5' />
                </button>
              )}
              <div className={s.titleRow}>
                {titleActive ? (
                  <InlineTextEditor
                    value={group.title}
                    active
                    editDisabled
                    isTouched={isDocFaqTouched}
                    titleClassName={s.title}
                    onChange={(title) => renameGroup(group.id, title)}
                    onDone={clearSaveZone}
                    onStart={() =>
                      setSaveZone({ type: FAQ_SAVE_ZONE.GROUP_TITLE, groupId: group.id })
                    }
                  />
                ) : (
                  <>
                    <div className={s.title}>{group.title}</div>
                    <div className={s.line} />
                  </>
                )}
              </div>
              {!editLocked && (
                <div className={cn(s.hoverActions, menuOpen && 'w-12 opacity-100')}>
                  {!titleActive && (
                    <button
                      type='button'
                      className={s.editButton}
                      aria-label={FAQ_EDITOR_COPY.EDIT_GROUP_TITLE_ARIA_LABEL}
                      onClick={() =>
                        setSaveZone({ type: FAQ_SAVE_ZONE.GROUP_TITLE, groupId: group.id })
                      }
                    >
                      <EditSVG className={s.editIcon} />
                    </button>
                  )}
                  <div className={s.actions}>
                    <ActionMenu
                      ariaLabel={FAQ_EDITOR_COPY.GROUP_ACTIONS_ARIA_LABEL}
                      items={GROUP_MENU_ITEMS}
                      onOpenChange={setMenuOpen}
                      onSelect={(action) => {
                        if (action === FAQ_GROUP_MENU_ACTION.ADD) {
                          onOpenItem(addItem(group.id))
                          return
                        }

                        if (action === FAQ_GROUP_MENU_ACTION.RENAME) {
                          setSaveZone({ type: FAQ_SAVE_ZONE.GROUP_TITLE, groupId: group.id })
                          return
                        }

                        deleteGroup(group.id)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <SortableFaqGroup
            className={s.list}
            columnId={group.id}
            ids={group.items.map((item) => item.id)}
            overClassName={s.listOver}
          >
            {group.items.map((item) => {
              const itemEditing =
                saveZone?.type === FAQ_SAVE_ZONE.ITEM_TITLE && saveZone.itemId === item.id

              return (
                <SortableFaqItem
                  key={item.id}
                  id={item.id}
                  columnId={group.id}
                  editing={editLocked || itemEditing}
                  targetPosition={targetDragItemId === item.id ? targetDragPosition : null}
                >
                  <Item
                    groupId={group.id}
                    item={item}
                    opened={openedItemId === item.id}
                    saveZone={saveZone}
                    editLocked={editLocked}
                    isDocFaqTouched={isDocFaqTouched}
                    onToggle={onToggleItem}
                  />
                </SortableFaqItem>
              )
            })}
          </SortableFaqGroup>
        </>
      )}
    </SortableFaqColumn>
  )
}
