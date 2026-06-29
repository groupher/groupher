import { useAutoAnimate } from '@formkit/auto-animate/react'
import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Add'
import ArrowSVG from '~/icons/ArrowSimple'
import CalendarSlashSVG from '~/icons/CalendarSlash'
import GrabDotsSVG from '~/icons/GrabDots'

import { SIDE_TREE_GROUP_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import SortableSideTreeChild from '../Dnd/SortableSideTreeChild'
import SortableSideTreeColumn from '../Dnd/SortableSideTreeColumn'
import SortableSideTreeGroup from '../Dnd/SortableSideTreeGroup'
import type { TSideTreeDragTarget } from '../Dnd/spec'
import useSalon, { cn } from '../salon/group/index'
import type {
  TEditingTarget,
  TSideTreeChildMenuAction,
  TSideTreeGroupMenuAction,
  TSideTreeGroup,
  TSideTreeLinkInput,
  TSideTreeNodeMenuAction,
} from '../spec'
import File from './File'
import GroupMenu from './GroupMenu'
import InlineTitleInput from './InlineTitleInput'
import SideTreeLinkItem from './Link'

const CHILD_LAYOUT_TRANSITION = {
  duration: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

type TProps = {
  group: TSideTreeGroup
  activeId: string | null
  editingTarget: TEditingTarget
  searchQuery?: string
  searching?: boolean
  showTargetLine: boolean
  targetDragItemId: string | null
  targetDragPosition: TSideTreeDragTarget['position'] | null
  onActivate: (id: string) => void
  onToggle: (groupId: string) => void
  onAddChild: (groupId: string, action: TSideTreeChildMenuAction) => void
  onCoverGroupAction: (groupId: string, inCover: boolean) => void
  onDeleteGroup: (groupId: string) => void
  onRenameGroup: (groupId: string, title: string) => void
  onRenameChild: (groupId: string, childId: string, title: string) => void
  onRenameLink: (groupId: string, childId: string, input: TSideTreeLinkInput) => void
  onCancelEdit: () => void
  onEdit: (target: TEditingTarget) => void
  onChildAction: (groupId: string, childId: string, action: TSideTreeNodeMenuAction) => void
  onChildStyleChange: (
    groupId: string,
    childId: string,
    marker: TSideTreeGroup['children'][number]['marker'],
  ) => void
}

const Group: FC<TProps> = ({
  group,
  activeId,
  editingTarget,
  searchQuery = '',
  searching = false,
  showTargetLine,
  targetDragItemId,
  targetDragPosition,
  onActivate,
  onToggle,
  onAddChild,
  onCoverGroupAction,
  onDeleteGroup,
  onRenameGroup,
  onRenameChild,
  onRenameLink,
  onCancelEdit,
  onEdit,
  onChildAction,
  onChildStyleChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [childrenListRef] = useAutoAnimate(CHILD_LAYOUT_TRANSITION)
  const { t } = useTrans()
  const s = useSalon({ actionVisible: menuOpen })
  const collapsed = group.expanded === false
  const groupInCover = group.publishState?.inCover === true
  const addDocLabel = t('dsb.cms.docs.side_tree.tooltip.new_doc')
  const editing =
    editingTarget?.type === SIDE_TREE_NODE_TYPE.GROUP && editingTarget.groupId === group.id
  const handleGroupMenuSelect = (action: TSideTreeGroupMenuAction): void => {
    if (
      action === SIDE_TREE_GROUP_MENU_ACTION.PAGE ||
      action === SIDE_TREE_GROUP_MENU_ACTION.LINK
    ) {
      onAddChild(group.id, action)
      return
    }

    if (action === SIDE_TREE_GROUP_MENU_ACTION.RENAME) {
      onEdit({ type: SIDE_TREE_NODE_TYPE.GROUP, groupId: group.id })
      return
    }

    if (
      action === SIDE_TREE_GROUP_MENU_ACTION.ADD_TO_COVER ||
      action === SIDE_TREE_GROUP_MENU_ACTION.REMOVE_FROM_COVER
    ) {
      onCoverGroupAction(group.id, groupInCover)
      return
    }

    onDeleteGroup(group.id)
  }

  return (
    <SortableSideTreeColumn
      className={cn(s.wrapper, collapsed && s.wrapperCollapsed, showTargetLine && s.wrapperTarget)}
      columnId={group.id}
      disabled={searching || editing}
    >
      {({ attributes, listeners, setActivatorNodeRef }) => (
        <>
          <div className={s.head}>
            {!searching && !editing && (
              <button
                ref={setActivatorNodeRef}
                type='button'
                className={s.dragHandle}
                aria-label={t('dsb.cms.docs.side_tree.drag_group')}
                {...attributes}
                {...listeners}
              >
                <GrabDotsSVG className={s.dragIcon} />
              </button>
            )}
            {editing ? (
              <InlineTitleInput
                value={group.title}
                onCancel={onCancelEdit}
                onConfirm={(title) => onRenameGroup(group.id, title)}
              />
            ) : (
              <button
                type='button'
                className={s.titleButton}
                onClick={searching ? undefined : () => onToggle(group.id)}
              >
                <span className={s.title}>{group.title}</span>
                <ArrowSVG className={cn(s.arrowIcon, collapsed && s.arrowCollapsed)} />
              </button>
            )}
            <div className={s.actionSlot}>
              {!searching && !editing && !groupInCover && (
                <div
                  className={s.coverStatus}
                  aria-label={t('dsb.cms.docs.side_tree.hidden_from_cover')}
                >
                  <CalendarSlashSVG className={s.coverStatusIcon} />
                </div>
              )}
              {!searching && !editing && (
                <button
                  type='button'
                  className={s.addButton}
                  aria-label={addDocLabel}
                  title={addDocLabel}
                  onClick={() => onAddChild(group.id, SIDE_TREE_GROUP_MENU_ACTION.PAGE)}
                >
                  <PlusSVG className={s.actionIcon} />
                </button>
              )}
              {!searching && (
                <div className={s.actions}>
                  <GroupMenu
                    inCover={groupInCover}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    onSelect={handleGroupMenuSelect}
                  />
                </div>
              )}
            </div>
          </div>
          <SortableSideTreeGroup
            className={cn(s.children, collapsed && s.collapsed)}
            columnId={group.id}
            ids={group.children.map((child) => child.id)}
            disabled={searching || collapsed}
            externalListRef={childrenListRef}
          >
            {group.children.map((child) => {
              const childEditing =
                editingTarget !== null &&
                'childId' in editingTarget &&
                editingTarget.childId === child.id

              return (
                <SortableSideTreeChild
                  key={child.id}
                  id={child.id}
                  columnId={group.id}
                  disabled={searching}
                  editing={childEditing}
                  targetPosition={targetDragItemId === child.id ? targetDragPosition : null}
                >
                  {child.type === SIDE_TREE_NODE_TYPE.PAGE ? (
                    <File
                      groupId={group.id}
                      groupInCover={groupInCover}
                      item={child}
                      active={activeId === child.id}
                      editingTarget={editingTarget}
                      searchQuery={searchQuery}
                      searching={searching}
                      onActivate={onActivate}
                      onRename={onRenameChild}
                      onCancelEdit={onCancelEdit}
                      onEdit={onEdit}
                      onAction={onChildAction}
                      onStyleChange={onChildStyleChange}
                    />
                  ) : (
                    <SideTreeLinkItem
                      groupId={group.id}
                      item={child}
                      editingTarget={editingTarget}
                      searchQuery={searchQuery}
                      searching={searching}
                      onRename={onRenameLink}
                      onCancelEdit={onCancelEdit}
                      onEdit={onEdit}
                      onAction={onChildAction}
                      onStyleChange={onChildStyleChange}
                    />
                  )}
                </SortableSideTreeChild>
              )
            })}
          </SortableSideTreeGroup>
        </>
      )}
    </SortableSideTreeColumn>
  )
}

export default Group
