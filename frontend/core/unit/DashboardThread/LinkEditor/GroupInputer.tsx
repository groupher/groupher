import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import Input from '~/widgets/Input'

import SavingBar from '../SavingBar'
import useSalon from './salon/group_inputer'
import type { TGroupInputerProps } from './spec'

const GroupInputer: FC<TGroupInputerProps> = ({ value, onChange, onConfirm, onCancel }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <SavingBar
      onConfirm={onConfirm}
      onCancel={onCancel}
      disabled={value.trim() === ''}
      isTouched
      minimal
    >
      <div className={s.wrapper}>
        <Input
          className={s.input}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('dsb.link_editor.group_placeholder')}
          focusOnMount
        />
      </div>
    </SavingBar>
  )
}

export default GroupInputer
