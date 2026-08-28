import { useAutoAnimate } from '@formkit/auto-animate/react'
import { type FC, useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Add'
import ArrowSVG from '~/icons/ArrowSimple'
import GrabDotsSVG from '~/icons/GrabDots'
import SignpostSVG from '~/icons/Signpost'

import { SIDE_TREE_GROUP_MENU_ACTION, SIDE_TREE_NODE_TYPE } from '../constant'
import { SIDE_TREE_DND_LANE, SIDE_TREE_DND_TIMING } from '../Dnd/constant'
import SortableSideTreeChild from '../Dnd/SortableSideTreeChild'
import SortableSideTreeGroup from '../Dnd/SortableSideTreeGroup'
import SortableSideTreeNode from '../Dnd/SortableSideTreeNode'
import type { TSideTreeDragTarget } from '../Dnd/spec'
import { SIDE_TREE_CLASS } from '../salon'
import { SIDE_TREE_SPACING } from '../salon/constant'
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
  coveredByAncestor?: boolean
  activeId: string | null
  depth: number
  editingTarget: TEditingTarget
  searchQuery?: string
  searching?: boolean
  index: number
  target: TSideTreeDragTarget | null
  onActivate: (id: string) => void
  onToggle: (groupId: string) => void
  onAddNestedGroup: (parentGroupId: string) => void
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
    marker: TSideTreeGroup['pages'][number]['marker'],
  ) => void
}

const Group: FC<TProps> = ({
  group,
  coveredByAncestor = false,
  activeId,
  depth,
  editingTarget,
  searchQuery = '',
  searching = false,
  index,
  target,
  onActivate,
  onToggle,
  onAddNestedGroup,
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
  const collapsed = group.expanded === false
  const groupInCover = group.publishState?.inCover === true
  const nestedGroups = group.pages.filter(
    (child): child is TSideTreeGroup => child.type === SIDE_TREE_NODE_TYPE.GROUP,
  )
  const leaves = group.pages.filter((child) => child.type !== SIDE_TREE_NODE_TYPE.GROUP)
  const s = useSalon({
    actionVisible: menuOpen,
    coverStatusVisible: groupInCover,
    nestedWithinGroup: depth > 1,
    topLevel: depth === 0,
  })
  const addDocLabel = t('dsb.cms.docs.side_tree.tooltip.new_doc')
  const editing =
    editingTarget?.type === SIDE_TREE_NODE_TYPE.GROUP && editingTarget.groupId === group.id

  useEffect(() => {
    if (!collapsed || target?.parentNodeId !== group.id || target.intent !== 'inside' || searching)
      return

    const timer = window.setTimeout(
      () => onToggle(group.id),
      SIDE_TREE_DND_TIMING.AUTO_EXPAND_DELAY_MS,
    )
    return () => window.clearTimeout(timer)
  }, [collapsed, group.id, onToggle, searching, target?.intent, target?.parentNodeId])
  const handleGroupMenuSelect = (action: TSideTreeGroupMenuAction): void => {
    if (action === SIDE_TREE_GROUP_MENU_ACTION.GROUP) {
      onAddNestedGroup(group.id)
      return
    }

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
    <SortableSideTreeNode
      className={cn(
        s.wrapper,
        collapsed && s.wrapperCollapsed,
        target?.intent === 'inside' && target.parentNodeId === group.id && s.wrapperTarget,
      )}
      childGroupCount={nestedGroups.length}
      childLeafCount={leaves.length}
      depth={depth}
      disabled={searching || editing}
      index={index}
      nodeId={group.id}
      nodeType={group.type}
      parentNodeId={group.parentNodeId}
      lane={SIDE_TREE_DND_LANE.GROUPS}
      targetIntent={target?.overNodeId === group.id ? target.intent : null}
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
            {!searching && !editing && (
              <div className={s.actionSlot}>
                {groupInCover ? (
                  <div
                    className={s.coverStatus}
                    role='img'
                    aria-label={t('dsb.cms.docs.side_tree.shown_on_cover')}
                  >
                    <SignpostSVG className={s.coverStatusIcon} />
                  </div>
                ) : null}
                <button
                  type='button'
                  className={s.addButton}
                  aria-label={addDocLabel}
                  title={addDocLabel}
                  onClick={() => onAddChild(group.id, SIDE_TREE_GROUP_MENU_ACTION.PAGE)}
                >
                  <PlusSVG className={s.actionIcon} />
                </button>
                <div className={s.actions}>
                  <GroupMenu
                    coveredByAncestor={coveredByAncestor}
                    inCover={groupInCover}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    onSelect={handleGroupMenuSelect}
                  />
                </div>
              </div>
            )}
          </div>
          {group.pages.length > 0 && (
            <SortableSideTreeGroup
              className={cn(s.children, collapsed && s.collapsed)}
              depth={depth + 1}
              ids={nestedGroups.map((child) => child.id)}
              lane={SIDE_TREE_DND_LANE.GROUPS}
              parentNodeId={group.id}
              disabled={searching}
              externalListRef={childrenListRef}
              targetInside={target?.intent === 'inside' && target.parentNodeId === group.id}
            >
              {nestedGroups.map((child, childIndex) => (
                <Group
                  key={child.id}
                  group={child}
                  coveredByAncestor={coveredByAncestor || groupInCover}
                  activeId={activeId}
                  depth={depth + 1}
                  editingTarget={editingTarget}
                  index={childIndex}
                  searchQuery={searchQuery}
                  searching={searching}
                  target={target}
                  onActivate={onActivate}
                  onToggle={onToggle}
                  onAddNestedGroup={onAddNestedGroup}
                  onAddChild={onAddChild}
                  onCoverGroupAction={onCoverGroupAction}
                  onDeleteGroup={onDeleteGroup}
                  onRenameGroup={onRenameGroup}
                  onRenameChild={onRenameChild}
                  onRenameLink={onRenameLink}
                  onCancelEdit={onCancelEdit}
                  onEdit={onEdit}
                  onChildAction={onChildAction}
                  onChildStyleChange={onChildStyleChange}
                />
              ))}
              <SortableSideTreeGroup
                className={cn(
                  SIDE_TREE_CLASS.leaf.list,
                  SIDE_TREE_SPACING.NODE_GAP,
                  leaves.length === 0
                    ? SIDE_TREE_CLASS.leaf.emptyList
                    : SIDE_TREE_CLASS.leaf.populatedList,
                )}
                depth={depth + 1}
                ids={leaves.map((child) => child.id)}
                lane={SIDE_TREE_DND_LANE.LEAVES}
                parentNodeId={group.id}
                disabled={searching}
                targetInside={target?.intent === 'inside' && target.parentNodeId === group.id}
              >
                {leaves.map((child, childIndex) => {
                  const childEditing =
                    editingTarget !== null &&
                    'childId' in editingTarget &&
                    editingTarget.childId === child.id

                  return (
                    <SortableSideTreeChild
                      key={child.id}
                      id={child.id}
                      depth={depth + 1}
                      disabled={searching}
                      editing={childEditing}
                      index={childIndex}
                      lane={SIDE_TREE_DND_LANE.LEAVES}
                      nodeType={child.type}
                      parentNodeId={group.id}
                      targetPosition={
                        target?.overNodeId === child.id && target.intent !== 'inside'
                          ? target.intent
                          : null
                      }
                    >
                      {child.type === SIDE_TREE_NODE_TYPE.PAGE ? (
                        <File
                          groupId={group.id}
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
            </SortableSideTreeGroup>
          )}
        </>
      )}
    </SortableSideTreeNode>
  )
}

export default Group
