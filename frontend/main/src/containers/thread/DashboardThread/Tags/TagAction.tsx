import type { FC } from 'react'

import { callTagEditEditor } from '~/signal'

import Tooltip from '~/widgets/Tooltip'
import MoreSVG from '~/icons/menu/MoreL'
import EditSVG from '~/icons/EditPen'
import ArrowSVG from '~/icons/Arrow'
import SettingSVG from '~/icons/Setting'

import ActionMenu from './ActionMenu'
import useTags from '../logic/useTags'
import type { TProps as TTagBarProps } from './TagBar'

import useSalon, { cn } from '../salon/tags/tag_action'

type TProps = Omit<TTagBarProps, 'settingTag'>

const TagAction: FC<TProps> = ({ tag, isFirst, isLast, total }) => {
  const s = useSalon()

  const {
    editingTag,
    activeTagGroup,
    editTag,
    moveTagUp,
    moveTagDown,
    moveTag2Top,
    moveTag2Bottom,
  } = useTags()
  const isEditMode = editingTag?.id === tag.id

  if (isEditMode) return null

  return (
    <div className={s.wrapper}>
      {activeTagGroup && !isFirst && (
        <div className={s.iconBox}>
          <ArrowSVG className={cn(s.icon, 'size-3 rotate-90')} onClick={() => moveTagUp(tag)} />
        </div>
      )}
      {activeTagGroup && !isLast && (
        <div className={s.iconBox}>
          <ArrowSVG className={cn(s.icon, 'size-3 -rotate-90')} onClick={() => moveTagDown(tag)} />
        </div>
      )}
      <div className={s.iconBox}>
        <EditSVG className={s.icon} onClick={() => editTag('editingTag', tag)} />
      </div>
      {activeTagGroup === null || total <= 2 ? (
        <div className={s.iconBox}>
          <SettingSVG
            className={s.icon}
            onClick={() => {
              editTag('settingTag', tag)
              callTagEditEditor()
            }}
          />
        </div>
      ) : (
        <Tooltip
          content={
            <ActionMenu
              isFirst={isFirst}
              isLast={isLast}
              activeTagGroup={activeTagGroup}
              move2Top={() => moveTag2Top(tag)}
              move2Bottom={() => moveTag2Bottom(tag)}
              onSetting={() => {
                editTag('settingTag', tag)
                callTagEditEditor()
              }}
            />
          }
          placement="bottom-end"
          trigger="mouseenter focus"
          offset={[4, 0]}
          delay={300}
          hideOnClick
          noPadding
        >
          <div className={s.iconBox}>
            <MoreSVG className={s.icon} />
          </div>
        </Tooltip>
      )}
    </div>
  )
}

export default TagAction
