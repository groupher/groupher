import { memo, type FC, useState } from 'react'

import type { TColorName, TTag } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import TagNode from '~/widgets/TagNode'

import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'
import useSalon, { cn } from './salon/tag_bar'
import TagAction from './TagAction'

export type TProps = {
  tag: TTag
  isFirst: boolean
  isLast: boolean
  total: number
  onSetting: (tag: TTag) => void
  inGroup?: boolean
  itemRef?: (node: HTMLDivElement | null) => void
}

const TagBar: FC<TProps> = ({
  tag,
  isFirst,
  isLast,
  total,
  onSetting,
  inGroup = false,
  itemRef,
}) => {
  const { editingTag, editTag, updateTag } = useTags()
  const isEditMode = editingTag?.id === tag.id
  const [draftTag, setDraftTag] = useState<TTag | null>(null)
  const editingDraft = draftTag ?? tag
  const [saving, setSaving] = useState(false)
  const s = useSalon({ color: editingTag?.color as TColorName, editing: isEditMode })
  const canSaveInline = !isEditMode || !!editingDraft.title?.trim()
  const desc = tag.desc?.trim()

  const cancelEdit = (): void => {
    setDraftTag(null)
    editTag('editingTag', null as unknown as TTag)
  }

  const startEdit = (): void => {
    setDraftTag(tag)
    editTag('editingTag', tag)
  }

  const saveEdit = async (): Promise<void> => {
    if (!editingDraft.title?.trim()) return

    setSaving(true)
    try {
      await updateTag(editingDraft)
    } catch {
      // Keep the local draft open so the user can retry without losing input.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={itemRef} className={cn(s.wrapper, isEditMode && s.wrapperEdit)}>
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
            activeColor={editingDraft.color}
            onChange={(color) => setDraftTag((prev) => ({ ...(prev ?? tag), color }))}
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
            value={editingDraft.title}
            onChange={(e) => setDraftTag((prev) => ({ ...(prev ?? tag), title: e.target.value }))}
            focusOnMount
          />
        ) : (
          <div className={s.info}>
            <div className={s.title}>{tag.title}</div>
            {tag.slug && (
              <>
                <div className={s.dotSep} />
                <div className={s.slug}>{tag.slug}</div>
              </>
            )}
            {desc && (
              <>
                <div className={s.dotSep} />
                <div className={s.desc}>{desc}</div>
              </>
            )}
          </div>
        )}
        <div className='grow' />
        {!isEditMode && (
          <TagAction
            tag={tag}
            isFirst={isFirst}
            isLast={isLast}
            total={total}
            onSetting={onSetting}
            onEdit={startEdit}
            inGroup={inGroup}
          />
        )}
      </SavingBar>
    </div>
  )
}

export default memo(TagBar)
