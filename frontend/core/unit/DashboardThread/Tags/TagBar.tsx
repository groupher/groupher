import type { FC } from 'react'

import type { TColorName, TTag } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import TagNode from '~/widgets/TagNode'

import { FIELD } from '../constant'
import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/tag_bar'
import SavingBar from '../SavingBar'
import TagAction from './TagAction'

export type TProps = {
  tag: TTag
  isFirst: boolean
  isLast: boolean
  total: number
  onSetting: (tag: TTag) => void
  inGroup?: boolean
  onBeforeReorder?: () => void
}

const TagBar: FC<TProps> = ({
  tag,
  isFirst,
  isLast,
  total,
  onSetting,
  inGroup = false,
  onBeforeReorder,
}) => {
  const { editingTag, editTag } = useTags()
  const isEditMode = editingTag?.id === tag.id
  const s = useSalon({ color: editingTag?.color as TColorName, editing: isEditMode })

  // isSetting={settingTag?.id === tag.id}
  //     hasSettingTag={settingTag !== null}

  return (
    <div key={tag.id} className={cn(s.wrapper, isEditMode && s.wrapperEdit)}>
      <SavingBar isTouched={isEditMode} field={FIELD.TAG} width='w-full'>
        {isEditMode ? (
          <ColorSelector
            activeColor={editingTag.color}
            onChange={(color) => editTag('editingTag', { ...editingTag, color })}
            placement='bottom-start'
            offset={[-8, 0]}
          >
            <div className={s.dotSelector}>
              <div className={s.dot} />
            </div>
          </ColorSelector>
        ) : (
          <TagNode color={tag.color as TColorName} boldHash dotTop={1} />
        )}
        {isEditMode ? (
          <Input
            className={s.input}
            width='w-48'
            value={editingTag.title}
            onChange={(e) => editTag('editingTag', { ...editingTag, title: e.target.value })}
            autoFocus
          />
        ) : (
          <div className={s.title}>{tag.title}</div>
        )}
        <div className='grow' />
        {!isEditMode && (
          <TagAction
            tag={tag}
            isFirst={isFirst}
            isLast={isLast}
            total={total}
            onSetting={onSetting}
            inGroup={inGroup}
            onBeforeReorder={onBeforeReorder}
          />
        )}
      </SavingBar>
    </div>
  )
}

export default TagBar
