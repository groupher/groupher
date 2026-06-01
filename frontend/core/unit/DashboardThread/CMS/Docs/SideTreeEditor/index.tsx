'use client'

import type { FC } from 'react'

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
  )
}

export default SideTreeEditor
