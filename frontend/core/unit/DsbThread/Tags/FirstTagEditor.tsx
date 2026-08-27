import useTrans from '~/hooks/useTrans'
import type { TColorName } from '~/spec'
import YesOrNoButtons from '~/ui/Buttons/YesOrNoButtons'
import ColorSelector from '~/ui/ColorSelector'
import Input from '~/ui/Input'

import useSalon, { cn } from './salon/group_block'

type TProps = {
  color: TColorName
  title: string
  loading: boolean
  canSave: boolean
  onColorChange: (color: TColorName) => void
  onTitleChange: (title: string) => void
  onCancel: () => void
  onConfirm: () => void
}

export default function FirstTagEditor({
  color,
  title,
  loading,
  canSave,
  onColorChange,
  onTitleChange,
  onCancel,
  onConfirm,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.firstTagEdit}>
      <ColorSelector
        activeColor={color}
        onChange={onColorChange}
        placement='bottom-start'
        offset={[-8, 0]}
      >
        <div className={s.dotSelector}>
          <div className={cn(s.dot, s.rainbow(color, 'bg'))} />
        </div>
      </ColorSelector>
      <Input
        className={s.tagInput}
        width='w-48'
        value={title}
        placeholder={t('dsb.tags.tag.new')}
        focusOnMount
        onChange={(event) => onTitleChange(event.target.value)}
        onEnter={onConfirm}
      />
      <div className='grow' />
      <YesOrNoButtons
        cancelText={t('dsb.saving_bar.cancel')}
        saveText={t('dsb.saving_bar.save')}
        loading={loading}
        disabled={!canSave}
        space={!loading ? 1.5 : 0}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </div>
  )
}
