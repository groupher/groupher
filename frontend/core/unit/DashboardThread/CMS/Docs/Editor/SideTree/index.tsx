'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { FC } from 'react'

import CoverWarningModal from './CoverWarningModal'
import SideTreeDndContext from './Dnd/SideTreeDndContext'
import Group from './Group'
import useSalon from './salon'
import type { TSideTreeController } from './spec'
import Toolbar from './Toolbar'

const GROUP_LAYOUT_TRANSITION = {
  duration: 180,
  easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const

type TProps = {
  controller: TSideTreeController
}

const SideTree: FC<TProps> = ({ controller }) => {
  const s = useSalon()
  const [groupListRef] = useAutoAnimate(GROUP_LAYOUT_TRANSITION)

  const {
    groups,
    activeId,
    editingTarget,
    coverWarning,
    activate,
    addChild,
    clearCoverWarning,
    deleteGroup,
    toggleGroup,
    toggleCoverGroup,
    publishGroup,
    moveGroupToDraft,
    renameGroup,
    renameChild,
    renameLink,
    cancelEdit,
    edit,
    handleChildAction,
    updateChildStyle,
    reorderGroups,
  } = controller

  return (
    <aside className={s.wrapper}>
      <CoverWarningModal message={coverWarning} onClose={clearCoverWarning} />
      <Toolbar />

      <SideTreeDndContext groups={groups} onCommit={reorderGroups}>
        {({
          activeDragColumnId,
          columns,
          targetDragColumnId,
          targetDragItemId,
          targetDragPosition,
        }) => (
          <div ref={groupListRef} className={s.groupList}>
            <SortableContext
              items={columns.map((group) => `docs-side-tree-sortable-group:${group.id}`)}
              strategy={verticalListSortingStrategy}
            >
              {columns.map((group) => {
                const showGroupTargetLine =
                  !!activeDragColumnId &&
                  !!targetDragColumnId &&
                  targetDragColumnId === group.id &&
                  activeDragColumnId !== group.id &&
                  !targetDragItemId

                return (
                  <Group
                    key={group.id}
                    group={group}
                    activeId={activeId}
                    editingTarget={editingTarget}
                    showTargetLine={showGroupTargetLine}
                    targetDragItemId={targetDragItemId}
                    targetDragPosition={targetDragPosition}
                    onActivate={activate}
                    onToggle={toggleGroup}
                    onAddChild={addChild}
                    onCoverGroupAction={toggleCoverGroup}
                    onPublishGroup={publishGroup}
                    onMoveGroupToDraft={moveGroupToDraft}
                    onDeleteGroup={deleteGroup}
                    onRenameGroup={renameGroup}
                    onRenameChild={renameChild}
                    onRenameLink={renameLink}
                    onCancelEdit={cancelEdit}
                    onEdit={edit}
                    onChildAction={handleChildAction}
                    onChildStyleChange={updateChildStyle}
                  />
                )
              })}
            </SortableContext>
          </div>
        )}
      </SideTreeDndContext>
    </aside>
  )
}

export default SideTree
