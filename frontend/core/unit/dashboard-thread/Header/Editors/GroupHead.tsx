import { startsWith } from 'ramda'
import type { FC } from 'react'

import { MORE_GROUP, ONE_LINK_GROUP } from '~/const/dashboard'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import Tooltip from '~/widgets/Tooltip'
import useHeader from '../../logic/useHeader'
import useSalon from '../../salon/header/editors/group_head'
import GroupInputer from './GroupInputer'
import GroupMenu from './GroupMenu'

type TGroupTitle = {
  title: string
}

const GroupTitle: FC<TGroupTitle> = ({ title }) => {
  const s = useSalon()

  // console.log('## title: ', title)

  if (startsWith(ONE_LINK_GROUP, title)) {
    return <div className={s.hintTitle}>单链接</div>
  }

  if (title === MORE_GROUP) {
    return (
      <div className={s.title}>
        更多 <ArrowSVG className={s.arrowIcon} />
      </div>
    )
  }

  return (
    <div className={s.title}>
      {title} <ArrowSVG className={s.arrowIcon} />
    </div>
  )
}

type TProps = {
  title: string
  curGroupIndex: number
  isEdgeLeft: boolean
  isEdgeRight: boolean

  moveRight: () => void
  moveLeft: () => void
  moveEdgeLeft: () => void
  moveEdgeRight: () => void
  onDelete: () => void
}

const GroupHead: FC<TProps> = ({
  title,
  curGroupIndex,
  moveLeft,
  moveRight,
  moveEdgeLeft,
  moveEdgeRight,
  onDelete,
  isEdgeLeft,
  isEdgeRight,
}) => {
  const s = useSalon()

  const {
    editingGroup,
    editingGroupIndex,
    triggerGroupUpdate,
    cancelGroupChange,
    updateEditingGroup,
    confirmGroupUpdate,
  } = useHeader()

  // null is void empty checked when input value is ""
  if (editingGroup !== null && editingGroupIndex === curGroupIndex) {
    return (
      <div className={s.wrapper}>
        <GroupInputer
          value={editingGroup}
          onChange={updateEditingGroup}
          onConfirm={confirmGroupUpdate}
          onCancel={cancelGroupChange}
        />
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <GroupTitle title={title} />

      <div className='grow' />

      {!(startsWith(ONE_LINK_GROUP, title) || title === MORE_GROUP) && (
        <EditSVG className={s.editIcon} onClick={() => triggerGroupUpdate(title, curGroupIndex)} />
      )}

      {title !== MORE_GROUP && (
        <Tooltip
          content={
            <GroupMenu
              moveLeft={moveLeft}
              moveRight={moveRight}
              moveEdgeLeft={moveEdgeLeft}
              moveEdgeRight={moveEdgeRight}
              isEdgeLeft={isEdgeLeft}
              isEdgeRight={isEdgeRight}
              onDelete={onDelete}
            />
          }
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
