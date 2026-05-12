import type { FC } from 'react'

import { cn } from '~/css'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import Tooltip from '~/widgets/Tooltip'

import DeleteMenu from './DeleteMenu'
import GroupInputer from './GroupInputer'
import useSalon from './salon/group_head'
import type { TGroupHeadProps } from './spec'

const GroupHead: FC<TGroupHeadProps> = ({
  title,
  currentIndex,
  collapsed = false,
  editingGroup,
  editingGroupIndex,
  dragHandle = null,
  onToggle,
  onEdit,
  onDelete,
  onCancelEdit,
  onChangeEdit,
  onConfirmEdit,
}) => {
  const s = useSalon()

  if (editingGroup !== null && editingGroupIndex === currentIndex) {
    return (
      <div className={s.wrapper}>
        {dragHandle}
        <GroupInputer
          value={editingGroup}
          onChange={onChangeEdit}
          onConfirm={onConfirmEdit}
          onCancel={onCancelEdit}
        />
      </div>
    )
  }

  const titleNode = onToggle ? (
    <button type='button' className={s.titleButton} onClick={onToggle}>
      {title}
      <ArrowSVG className={cn(s.arrowIcon, collapsed && s.arrowCollapsed)} />
    </button>
  ) : (
    <div className={s.title}>{title}</div>
  )

  return (
    <div className={s.wrapper}>
      {dragHandle}
      {titleNode}
      <div className='grow' />
      {onEdit && <EditSVG className={s.editIcon} onClick={() => onEdit(title, currentIndex)} />}
      {onDelete && (
        <Tooltip
          content={<DeleteMenu onDelete={onDelete} />}
          placement='bottom-end'
          trigger='click'
          offset={[4, 0]}
          hideOnClick
          noPadding
        >
          <MoreSVG className={s.settingIcon} />
        </Tooltip>
      )}
    </div>
  )
}

export default GroupHead
