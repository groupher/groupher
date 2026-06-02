'use client'

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import Group from './Group'
import GroupAdder from './GroupAdder'
import useSalon from './salon'
import SideTreeDndContext from './SideTreeDndContext'
import useSideTreeEditor from './useSideTreeEditor'

const SideTreeEditor: FC = () => {
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
  } = useSideTreeEditor()

  return (
    <PanelGroup
      className={s.panelGroup}
      orientation='horizontal'
      resizeTargetMinimumSize={{ fine: 12, coarse: 28 }}
    >
      <Panel
        id='docs-side-tree'
        className={s.sidePanel}
        defaultSize={180}
        minSize={120}
        maxSize={210}
        groupResizeBehavior='preserve-pixel-size'
      >
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

          <GroupAdder onAddGroup={addGroup} />
        </aside>
      </Panel>

      <Separator id='docs-side-tree-resizer' className={s.resizeHandle}>
        <div className={s.resizeLine} />
      </Separator>

      <Panel id='docs-editor-space' className={s.fillPanel} minSize={0} />
    </PanelGroup>
  )
}

export default SideTreeEditor
