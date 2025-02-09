import type { FC } from 'react'

import type { TColorName, TTag } from '~/spec'

import TagNode from '~/widgets/TagNode'
import Input from '~/widgets/Input'
import ColorSelector from '~/widgets/ColorSelector'

import { SETTING_FIELD } from '../constant'

import SavingBar from '../SavingBar'
import TagAction from './TagAction'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/tag_bar'

export type TProps = {
  tag: TTag
  isFirst: boolean
  isLast: boolean
  total: number
}

const TagBar: FC<TProps> = ({ tag, isFirst, isLast, total }) => {
  const { editingTag, activeTagGroup, editTag } = useTags()
  const s = useSalon({ color: editingTag?.color as TColorName })

  const isEditMode = editingTag?.id === tag.id

  // isSetting={settingTag?.id === tag.id}
  //     hasSettingTag={settingTag !== null}

  return (
    <div key={tag.id} className={cn(s.wrapper, isEditMode && s.wrapperEdit)}>
      <SavingBar isTouched={isEditMode} field={SETTING_FIELD.TAG}>
        {isEditMode ? (
          <ColorSelector
            activeColor={editingTag.color}
            onChange={(color) => editTag('editingTag', { ...editingTag, color })}
            placement="bottom-start"
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
            value={editingTag.title}
            onChange={(e) => editTag('editingTag', { ...editingTag, title: e.target.value })}
            autoFocus
          />
        ) : (
          <div className={s.title}>
            {tag.title}
            {!activeTagGroup && <div className={s.catNote}>({tag.group})</div>}
          </div>
        )}
        <div className="grow" />
        {!isEditMode && <TagAction tag={tag} isFirst={isFirst} isLast={isLast} total={total} />}
      </SavingBar>
    </div>
  )
}

export default TagBar
