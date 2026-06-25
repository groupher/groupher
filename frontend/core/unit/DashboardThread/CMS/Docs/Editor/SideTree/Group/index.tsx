import { useAutoAnimate } from '@formkit/auto-animate/react'
import { type FC, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Add'
import ArrowSVG from '~/icons/ArrowSimple'
import CalendarSlashSVG from '~/icons/CalendarSlash'
import GrabDotsSVG from '~/icons/GrabDots'
import PaperPlaneTiltSVG from '~/icons/PaperPlaneTilt'

import { SIDE_TREE_GROUP_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import SortableSideTreeChild from '../Dnd/SortableSideTreeChild'
import SortableSideTreeColumn from '../Dnd/SortableSideTreeColumn'
import SortableSideTreeGroup from '../Dnd/SortableSideTreeGroup'
import type { TSideTreeDragTarget } from '../Dnd/spec'
import { isPublicDoc, needsPublishAttention } from '../helper'
import useSalon, { cn } from '../salon/group'
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
import Link from './Link'

const CHILD_LAYOUT_TRANSITION = {
  duration: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

type TProps = {
  group: TSideTreeGroup
  activeId: string | null
  editingTarget: TEditingTarget
  showTargetLine: boolean
  targetDragItemId: string | null
  targetDragPosition: TSideTreeDragTarget['position'] | null
  onActivate: (id: string) => void
  onToggle: (groupId: string) => void
  onAddChild: (groupId: string, action: TSideTreeChildMenuAction) => void
  onCoverGroupAction: (groupId: string, inCover: boolean) => void
  onPublishGroup: (groupId: string) => void
  onMoveGroupToDraft: (groupId: string) => void
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
  showTargetLine,
  targetDragItemId,
  targetDragPosition,
  onActivate,
  onToggle,
  onAddChild,
  onCoverGroupAction,
  onPublishGroup,
  onMoveGroupToDraft,
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
  const publishableChildCount = group.children.filter((child) =>
    needsPublishAttention(child.publishState),
  ).length
  const draftableChildCount = group.children.filter((child) =>
    isPublicDoc(child.publishState),
  ).length
  const publishGroupVisible = publishableChildCount >= 2
  const publishGroupShortcutVisible = publishableChildCount > 0
  const draftGroupVisible = draftableChildCount >= 2
  const addDocLabel = t('dsb.cms.docs.side_tree.tooltip.new_doc')
  const publishGroupChangesLabel = t('dsb.cms.docs.side_tree.tooltip.publish_group_changes')
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

    if (action === SIDE_TREE_GROUP_MENU_ACTION.PUBLISH_GROUP) {
      onPublishGroup(group.id)
      return
    }

    if (action === SIDE_TREE_GROUP_MENU_ACTION.MOVE_GROUP_TO_DRAFT) {
      onMoveGroupToDraft(group.id)
      return
    }

    onDeleteGroup(group.id)
  }

  return (
    <SortableSideTreeColumn
      className={cn(s.wrapper, showTargetLine && s.wrapperTarget)}
      columnId={group.id}
      disabled={editing}
    >
      {({ attributes, listeners, setActivatorNodeRef }) => (
        <>
          <div className={s.head}>
            {!editing && (
              <button
                ref={setActivatorNodeRef}
                type='button'
                className={s.dragHandle}
                aria-label='Drag docs group'
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
              <button type='button' className={s.titleButton} onClick={() => onToggle(group.id)}>
                <span className={s.title}>{group.title}</span>
                <ArrowSVG className={cn(s.arrowIcon, collapsed && s.arrowCollapsed)} />
              </button>
            )}
            <div className={s.actionSlot}>
              {!editing && !groupInCover && (
                <div className={s.coverStatus} aria-label='Hidden from cover'>
                  <CalendarSlashSVG className={s.coverStatusIcon} />
                </div>
              )}
              {!editing && (
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
              {!editing && publishGroupShortcutVisible && (
                <button
                  type='button'
                  className={s.publishButton}
                  aria-label={publishGroupChangesLabel}
                  title={publishGroupChangesLabel}
                  onClick={() => onPublishGroup(group.id)}
                >
                  <PaperPlaneTiltSVG className={s.publishIcon} />
                </button>
              )}
              <div className={s.actions}>
                <GroupMenu
                  inCover={groupInCover}
                  open={menuOpen}
                  publishVisible={publishGroupVisible}
                  draftVisible={draftGroupVisible}
                  onOpenChange={setMenuOpen}
                  onSelect={handleGroupMenuSelect}
                />
              </div>
            </div>
          </div>
          <SortableSideTreeGroup
            className={cn(s.children, collapsed && s.collapsed)}
            columnId={group.id}
            ids={group.children.map((child) => child.id)}
            disabled={collapsed}
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
                      onActivate={onActivate}
                      onRename={onRenameChild}
                      onCancelEdit={onCancelEdit}
                      onEdit={onEdit}
                      onAction={onChildAction}
                      onStyleChange={onChildStyleChange}
                    />
                  ) : (
                    <Link
                      groupId={group.id}
                      item={child}
                      editingTarget={editingTarget}
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
