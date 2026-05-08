import type { FC } from 'react'

import ArrowSVG from '~/icons/Arrow'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import SettingSVG from '~/icons/Setting'
import Tooltip from '~/widgets/Tooltip'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/tag_action'
import ActionMenu from './ActionMenu'
import type { TProps as TTagBarProps } from './TagBar'

type TProps = Omit<TTagBarProps, 'settingTag'>

const TagAction: FC<TProps> = ({
  tag,
  isFirst,
  isLast,
  total,
  onSetting,
  inGroup,
  onBeforeReorder,
}) => {
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
  const hasGroupContext = inGroup || activeTagGroup !== null

  if (isEditMode) return null

  return (
    <div className={s.wrapper}>
      {hasGroupContext && !isFirst && (
        <div className={s.sortIconBox}>
          <ArrowSVG
            className={cn(s.icon, 'size-3 rotate-90')}
            onClick={() => {
              onBeforeReorder?.()
              moveTagUp(tag)
            }}
          />
        </div>
      )}
      {hasGroupContext && !isLast && (
        <div className={s.sortIconBox}>
          <ArrowSVG
            className={cn(s.icon, 'size-3 -rotate-90')}
            onClick={() => {
              onBeforeReorder?.()
              moveTagDown(tag)
            }}
          />
        </div>
      )}
      <div className={s.iconBox}>
        <EditSVG className={s.icon} onClick={() => editTag('editingTag', tag)} />
      </div>
      {!hasGroupContext || total <= 2 ? (
        <div className={s.iconBox}>
          <SettingSVG
            className={s.icon}
            onClick={() => {
              editTag('settingTag', tag)
              onSetting(tag)
            }}
          />
        </div>
      ) : (
        <Tooltip
          content={
            <ActionMenu
              isFirst={isFirst}
              isLast={isLast}
              activeTagGroup={tag.group || null}
              move2Top={() => {
                onBeforeReorder?.()
                moveTag2Top(tag)
              }}
              move2Bottom={() => {
                onBeforeReorder?.()
                moveTag2Bottom(tag)
              }}
              onSetting={() => {
                editTag('settingTag', tag)
                onSetting(tag)
              }}
            />
          }
          placement='bottom-end'
          trigger='mouseenter focus'
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
