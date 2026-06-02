'use client'

import type { FC } from 'react'
import { Group as PanelGroup, Panel, Separator } from 'react-resizable-panels'

import Group from './Group'
import GroupAdder from './GroupAdder'
import useSalon from './salon'
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
    toggleGroup,
    renameGroup,
    renameChild,
    cancelEdit,
    edit,
    handleChildAction,
    updateChildStyle,
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
          <div className={s.groupList}>
            {groups.map((group) => (
              <Group
                key={group.id}
                group={group}
                activeId={activeId}
                editingTarget={editingTarget}
                onActivate={activate}
                onToggle={toggleGroup}
                onAddChild={addChild}
                onRenameGroup={renameGroup}
                onRenameChild={renameChild}
                onCancelEdit={cancelEdit}
                onEdit={edit}
                onChildAction={handleChildAction}
                onChildStyleChange={updateChildStyle}
              />
            ))}
          </div>

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
