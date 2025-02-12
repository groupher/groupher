import type { FC } from 'react'

import Input from '~/widgets/Input'

import SavingBar from '../../SavingBar'
import useSalon from '../../salon/footer/editors/group_inputer'

type TProps = {
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

const GroupInputer: FC<TProps> = ({ value, onChange, onConfirm, onCancel }) => {
  const s = useSalon()

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
          placeholder="// 新分组名称"
          autoFocus
        />
      </div>
    </SavingBar>
  )
}

export default GroupInputer
