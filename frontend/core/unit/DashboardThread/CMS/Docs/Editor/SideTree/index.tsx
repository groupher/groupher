'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { FC } from 'react'

import SideTreeDndContext from './Dnd/SideTreeDndContext'
import Group from './Group'
import GroupAdder from './GroupAdder'
import useSalon from './salon'
import type { TSideTreeController } from './useSideTree'

type TProps = {
  controller: TSideTreeController
}

const SideTree: FC<TProps> = ({ controller }) => {
  const s = useSalon()

  const {
    groups,
    activeId,
    editingTarget,
    activate,
    addGroup,
    addChild,
    deleteGroup,
    toggleGroup,
    renameGroup,
    renameChild,
    cancelEdit,
    edit,
    handleChildAction,
    updateChildStyle,
    reorderGroups,
  } = controller

  return (
    <aside className={s.wrapper}>
      <SideTreeDndContext groups={groups} onCommit={reorderGroups}>
        {({
          activeDragColumnId,
          columns,
          targetDragColumnId,
          targetDragItemId,
          targetDragPosition,
        }) => (
          <div className={s.groupList}>
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
                    onDeleteGroup={deleteGroup}
                    onRenameGroup={renameGroup}
                    onRenameChild={renameChild}
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

      <GroupAdder hasGroups={groups.length > 0} onAddGroup={addGroup} />
    </aside>
  )
}

export default SideTree
