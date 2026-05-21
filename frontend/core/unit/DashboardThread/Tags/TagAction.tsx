import type { FC } from 'react'

import EditSVG from '~/icons/EditPen'
import SettingSVG from '~/icons/Setting'

import useTags from '../logic/useTags'
import useSalon from './salon/tag_action'
import type { TProps as TTagBarProps } from './TagBar'

type TProps = TTagBarProps & {
  onEdit: () => void
}

const TagAction: FC<TProps> = ({ tag, onSetting, onEdit }) => {
  const s = useSalon()

  const { editingTag, editTag } = useTags()
  const isEditMode = editingTag?.id === tag.id
  const openSetting = (): void => {
    editTag('settingTag', tag)
    onSetting(tag)
  }

  if (isEditMode) return null

  return (
    <div className={s.wrapper}>
      <button type='button' className={s.editIconBox} onClick={onEdit} aria-label='Edit tag'>
        <EditSVG className={s.icon} />
      </button>
      <button type='button' className={s.iconBox} onClick={openSetting} aria-label='Tag settings'>
        <SettingSVG className={s.icon} />
      </button>
    </div>
  )
}

export default TagAction
