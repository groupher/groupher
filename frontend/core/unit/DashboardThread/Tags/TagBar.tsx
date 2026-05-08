import { type FC, useEffect, useState } from 'react'

import type { TColorName, TTag } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import TagNode from '~/widgets/TagNode'

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
  const { editingTag, editTag, updateTag } = useTags()
  const isEditMode = editingTag?.id === tag.id
  const [draftTag, setDraftTag] = useState<TTag>(tag)
  const [saving, setSaving] = useState(false)
  const s = useSalon({ color: editingTag?.color as TColorName, editing: isEditMode })
  const canSaveInline = !isEditMode || !!draftTag.title?.trim()

  useEffect(() => {
    if (isEditMode) setDraftTag(editingTag)
  }, [editingTag, isEditMode])

  const cancelEdit = (): void => {
    setDraftTag(tag)
    editTag('editingTag', null as unknown as TTag)
  }

  const saveEdit = async (): Promise<void> => {
    if (!draftTag.title?.trim()) return

    setSaving(true)
    try {
      await updateTag(draftTag)
    } catch {
      // Keep the local draft open so the user can retry without losing input.
    } finally {
      setSaving(false)
    }
  }

  // isSetting={settingTag?.id === tag.id}
  //     hasSettingTag={settingTag !== null}

  return (
    <div key={tag.id} className={cn(s.wrapper, isEditMode && s.wrapperEdit)}>
      <SavingBar
        isTouched={isEditMode}
        width='w-full'
        disabled={!canSaveInline}
        loading={saving}
        onCancel={cancelEdit}
        onConfirm={() => void saveEdit()}
      >
        {isEditMode ? (
          <ColorSelector
            activeColor={draftTag.color}
            onChange={(color) => setDraftTag({ ...draftTag, color })}
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
            value={draftTag.title}
            onChange={(e) => setDraftTag({ ...draftTag, title: e.target.value })}
            autoFocus
          />
        ) : (
          <>
            <div className={s.title}>{tag.title}</div>
            {tag.slug && <div className={s.slug}>({tag.slug})</div>}
          </>
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
